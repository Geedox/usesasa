import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { creditLedger } from "@/lib/db/schema";

const SIGNUP_BONUS = 5;

export async function getBalance(userId: string): Promise<number> {
  const rows = await db.select({ delta: creditLedger.delta }).from(creditLedger).where(eq(creditLedger.userId, userId));
  return rows.reduce((sum, r) => sum + r.delta, 0);
}

// Grant the free-trial credits once (FRD §5.7.4). Returns the current balance.
export async function ensureSignupBonus(userId: string): Promise<number> {
  const existing = await db
    .select({ id: creditLedger.id })
    .from(creditLedger)
    .where(eq(creditLedger.userId, userId))
    .limit(1);
  if (existing.length === 0) {
    await db.insert(creditLedger).values({ userId, delta: SIGNUP_BONUS, reason: "signup_bonus", balanceAfter: SIGNUP_BONUS });
    return SIGNUP_BONUS;
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
