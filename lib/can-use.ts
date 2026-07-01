import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { getBalance } from "@/lib/credits";
import { isSubscriber, getEntitlement } from "@/lib/subscription";

export const NO_CREDIT_MESSAGE = "Please add credits to use Sasa.";
export const PLAN_LIMIT_MESSAGE = "You have reached your plan's limit for this cycle. Upgrade or wait for the reset.";
export const SUSPENDED_MESSAGE = "Your account has been suspended. Contact support@usesasa.xyz.";

// Whether an admin has suspended this account. A suspended user is blocked from every
// paid Sasa action and from the dashboard.
export async function isSuspended(userId: string): Promise<boolean> {
  const u = await db.query.users.findFirst({ where: eq(users.id, userId), columns: { suspendedAt: true } });
  return !!u?.suspendedAt;
}

// The single gate for every Sasa action that costs money (extension + Telegram bot).
// Suspended accounts are blocked outright. Otherwise credits users (Nigeria / free)
// need at least 1 credit; subscribers (international) need allowance left in the cycle.
// Returns a user-facing error when blocked.
export async function canUseSasa(userId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (await isSuspended(userId)) return { ok: false, error: SUSPENDED_MESSAGE };
  if (await isSubscriber(userId)) {
    const ent = await getEntitlement(userId);
    return ent.remaining > 0 ? { ok: true } : { ok: false, error: PLAN_LIMIT_MESSAGE };
  }
  return (await getBalance(userId)) >= 1 ? { ok: true } : { ok: false, error: NO_CREDIT_MESSAGE };
}

// Whether to show the "add credits" gate on the dashboard/browse/tracker. We prompt a
// bit earlier than the hard action gate (default at 1 credit or fewer), since a full
// application costs more than one credit, so users top up before getting stuck.
// Subscribers are only gated when their plan allowance is used up.
export async function belowCreditFloor(userId: string, floor = 1): Promise<boolean> {
  if (await isSubscriber(userId)) {
    return (await getEntitlement(userId)).remaining <= 0;
  }
  return (await getBalance(userId)) <= floor;
}
