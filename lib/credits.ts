import { and, eq, ilike } from "drizzle-orm";
import { db } from "@/lib/db";
import { creditLedger, applications } from "@/lib/db/schema";
import { enqueueTailorApplication, enqueueSubmitApplication } from "@/lib/queue";

const SIGNUP_BONUS = 10;
export const INTERVIEW_COST = 24; // credits per interview-prep booking (covers mentor pay + margin)

// Credits expire 30 days after they are granted if unused, so people can't load up
// and sit on a balance forever. Expiry is computed here (no background sweep needed):
// each positive ledger entry is a "lot" with its own expiry, debits consume the
// oldest still-valid lot first (FIFO), and any lot past its expiry is not counted.
export const CREDIT_TTL_DAYS = 30;
const TTL_MS = CREDIT_TTL_DAYS * 86_400_000;

type Lot = { remaining: number; expiresAt: number };

// Replay the ledger into lots, applying debits FIFO and respecting expiry at the
// time each debit happened (a debit can't draw from a lot already expired then).
async function lotsFor(userId: string): Promise<Lot[]> {
  const rows = await db
    .select({ delta: creditLedger.delta, createdAt: creditLedger.createdAt })
    .from(creditLedger)
    .where(eq(creditLedger.userId, userId))
    .orderBy(creditLedger.createdAt);

  const lots: Lot[] = [];
  for (const r of rows) {
    const t = r.createdAt.getTime();
    if (r.delta > 0) {
      lots.push({ remaining: r.delta, expiresAt: t + TTL_MS });
      continue;
    }
    let need = -r.delta;
    for (const lot of lots) {
      if (need <= 0) break;
      if (lot.remaining <= 0 || lot.expiresAt <= t) continue; // empty or already expired at debit time
      const take = Math.min(lot.remaining, need);
      lot.remaining -= take;
      need -= take;
    }
  }
  return lots;
}

export async function getBalance(userId: string): Promise<number> {
  const now = Date.now();
  const lots = await lotsFor(userId);
  return lots.reduce((sum, l) => sum + (l.expiresAt > now ? Math.max(0, l.remaining) : 0), 0);
}

// Balance plus the soonest-expiring credits (for an "expiring soon" warning in the UI).
export async function creditStatus(
  userId: string,
): Promise<{ balance: number; expiringAmount: number; expiringAt: Date | null }> {
  const now = Date.now();
  const live = (await lotsFor(userId)).filter((l) => l.remaining > 0 && l.expiresAt > now);
  const balance = live.reduce((s, l) => s + l.remaining, 0);
  const soon = live
    .filter((l) => l.expiresAt <= now + 7 * 86_400_000)
    .sort((a, b) => a.expiresAt - b.expiresAt);
  return {
    balance,
    expiringAmount: soon.reduce((s, l) => s + l.remaining, 0),
    expiringAt: soon.length ? new Date(soon[0].expiresAt) : null,
  };
}

// Grant the free-trial credits once (FRD §5.7.4). Returns the current balance.
export async function ensureSignupBonus(userId: string): Promise<number> {
  // Grant once, keyed on the signup_bonus reason (not "any ledger row"), so users who
  // were created before the signup hook — but already have other entries, e.g. a
  // purchase — still get their trial credits backfilled on next load.
  const existing = await db
    .select({ id: creditLedger.id })
    .from(creditLedger)
    .where(and(eq(creditLedger.userId, userId), eq(creditLedger.reason, "signup_bonus")))
    .limit(1);
  if (existing.length === 0) {
    const after = (await getBalance(userId)) + SIGNUP_BONUS;
    await db.insert(creditLedger).values({ userId, delta: SIGNUP_BONUS, reason: "signup_bonus", balanceAfter: after });
  }
  return getBalance(userId);
}

// Debit 1 credit for a successful submission. Refuses below 0. Returns the new balance, or null if no credits.
export async function chargeForSubmission(userId: string, applicationId: string): Promise<number | null> {
  const balance = await getBalance(userId);
  if (balance <= 0) return null;
  const after = balance - 1;
  await db
    .insert(creditLedger)
    .values({ userId, delta: -1, reason: "application_charge", relatedId: applicationId, balanceAfter: after });
  return after;
}

// Debit 1 credit for tailoring a CV + cover letter. Refuses below 0. Returns the new
// balance, or null if the user has no credits (so we don't spend the LLM for free).
export async function chargeForTailoring(userId: string, applicationId: string): Promise<number | null> {
  const balance = await getBalance(userId);
  if (balance <= 0) return null;
  const after = balance - 1;
  await db
    .insert(creditLedger)
    .values({ userId, delta: -1, reason: "tailoring_charge", relatedId: applicationId, balanceAfter: after });
  return after;
}

// Debit the 3 interview-prep credits. Refuses if the user can't cover it. Returns
// the new balance, or null if there aren't enough credits.
export async function chargeForInterview(userId: string, bookingId: string): Promise<number | null> {
  const balance = await getBalance(userId);
  if (balance < INTERVIEW_COST) return null;
  const after = balance - INTERVIEW_COST;
  await db
    .insert(creditLedger)
    .values({ userId, delta: -INTERVIEW_COST, reason: "interview_booking", relatedId: bookingId, balanceAfter: after });
  return after;
}

// Return the 3 credits when an interview is cancelled. Returns the new balance.
export async function refundInterview(userId: string, bookingId: string): Promise<number> {
  const balance = await getBalance(userId);
  const after = balance + INTERVIEW_COST;
  await db
    .insert(creditLedger)
    .values({ userId, delta: INTERVIEW_COST, reason: "interview_refund", relatedId: bookingId, balanceAfter: after });
  return after;
}

// After a top-up, re-queue any application that was parked in needs_user only because
// the user ran out of credits. A human still approves everything:
//   - already tailored (approved to submit, then blocked at charge) -> re-queue submit.
//   - never tailored (blocked before tailoring) -> re-tailor; it lands back in review.
// The worker re-checks credits per app, so this is safe even if the top-up does not
// cover every stuck application.
export async function retryCreditBlockedApplications(userId: string): Promise<number> {
  const stuck = await db
    .select({ id: applications.id, tailoredCv: applications.tailoredCv })
    .from(applications)
    .where(and(
      eq(applications.userId, userId),
      eq(applications.state, "needs_user"),
      ilike(applications.submissionNote, "%credit%"),
    ));

  let n = 0;
  for (const a of stuck) {
    if (a.tailoredCv) {
      await db.update(applications).set({ state: "queued", submissionNote: null }).where(eq(applications.id, a.id));
      await enqueueSubmitApplication({ applicationId: a.id });
    } else {
      await db.update(applications).set({ state: "drafted", submissionNote: null }).where(eq(applications.id, a.id));
      await enqueueTailorApplication({ applicationId: a.id });
    }
    n++;
  }
  return n;
}

// Add credits (e.g. a Paystack pack purchase). Returns the new balance.
export async function addCredits(
  userId: string,
  amount: number,
  reason: "paystack_purchase" | "manual_adjustment" | "beta_bonus" | "referral_bonus",
  relatedId?: string,
): Promise<number> {
  const balance = await getBalance(userId);
  const after = balance + amount;
  await db.insert(creditLedger).values({ userId, delta: amount, reason, relatedId, balanceAfter: after });
  // Best-effort: resume anything that was stuck waiting on credits.
  await retryCreditBlockedApplications(userId).catch((e) => console.error("[credit-retry] failed:", e));
  return after;
}
