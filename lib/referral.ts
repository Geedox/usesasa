import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, referrals } from "@/lib/db/schema";
import { addCredits } from "@/lib/credits";

export const REFERRAL_REWARD = 5; // credits the referrer earns per milestone
// Pack ids that earn the referrer a milestone reward (the ₦15k and ₦30k packs).
const PACK_15K = "ngn-70";
const PACK_30K = "ngn-150";

// 6-char code, no ambiguous characters (no 0/O/1/I/L).
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
function randomCode(): string {
  let s = "";
  for (let i = 0; i < 6; i++) s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return s;
}

// Generate a unique code and set it on the user if they don't have one. Returns the code.
export async function ensureReferralCode(userId: string): Promise<string> {
  const u = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (u?.referralCode) return u.referralCode;
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = randomCode();
    const taken = await db.query.users.findFirst({ where: eq(users.referralCode, code) });
    if (taken) continue;
    await db.update(users).set({ referralCode: code }).where(eq(users.id, userId));
    return code;
  }
  throw new Error("could not generate a unique referral code");
}

// Called when a referred user finishes onboarding: link them to the referrer and
// award the referrer +5 (once). No-op if the code is invalid, self, or already used.
export async function consumeSignupReferral(referredUserId: string, rawCode: string | null | undefined): Promise<void> {
  const code = (rawCode ?? "").trim().toUpperCase();
  if (!code) return;

  const referrer = await db.query.users.findFirst({ where: eq(users.referralCode, code) });
  if (!referrer || referrer.id === referredUserId) return; // invalid or self-referral

  const existing = await db.query.referrals.findFirst({ where: eq(referrals.referredId, referredUserId) });
  if (existing) return; // already referred

  const [row] = await db
    .insert(referrals)
    .values({ referrerId: referrer.id, referredId: referredUserId, code, rewardedSignup: true })
    .onConflictDoNothing({ target: referrals.referredId })
    .returning({ id: referrals.id });
  if (!row) return; // race: someone else inserted

  await addCredits(referrer.id, REFERRAL_REWARD, "referral_bonus", row.id);
}

// Called when a referred user buys a pack: award the referrer the ₦15k / ₦30k
// milestone once. Safe to call for any pack — only the two milestone packs reward.
export async function rewardReferralForPack(referredUserId: string, packId: string | undefined): Promise<void> {
  if (packId !== PACK_15K && packId !== PACK_30K) return;
  const ref = await db.query.referrals.findFirst({ where: eq(referrals.referredId, referredUserId) });
  if (!ref) return;

  if (packId === PACK_15K && !ref.rewarded15k) {
    await addCredits(ref.referrerId, REFERRAL_REWARD, "referral_bonus", ref.id);
    await db.update(referrals).set({ rewarded15k: true }).where(eq(referrals.id, ref.id));
  } else if (packId === PACK_30K && !ref.rewarded30k) {
    await addCredits(ref.referrerId, REFERRAL_REWARD, "referral_bonus", ref.id);
    await db.update(referrals).set({ rewarded30k: true }).where(eq(referrals.id, ref.id));
  }
}

// Summary for the referrals UI.
export async function referralSummary(userId: string): Promise<{ code: string; referredCount: number; creditsEarned: number }> {
  const code = await ensureReferralCode(userId);
  const rows = await db.select().from(referrals).where(eq(referrals.referrerId, userId));
  const creditsEarned = rows.reduce(
    (sum, r) => sum + (r.rewardedSignup ? REFERRAL_REWARD : 0) + (r.rewarded15k ? REFERRAL_REWARD : 0) + (r.rewarded30k ? REFERRAL_REWARD : 0),
    0,
  );
  return { code, referredCount: rows.length, creditsEarned };
}
