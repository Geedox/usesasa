import { getBalance } from "@/lib/credits";
import { isSubscriber, getEntitlement } from "@/lib/subscription";

export const NO_CREDIT_MESSAGE = "Please add credits to use Sasa.";
export const PLAN_LIMIT_MESSAGE = "You have reached your plan's limit for this cycle. Upgrade or wait for the reset.";

// The single gate for every Sasa action that costs money (extension + Telegram bot).
// Credits users (Nigeria / free) need at least 1 credit; subscribers (international)
// need allowance left in the cycle. Returns a user-facing error when blocked.
export async function canUseSasa(userId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (await isSubscriber(userId)) {
    const ent = await getEntitlement(userId);
    return ent.remaining > 0 ? { ok: true } : { ok: false, error: PLAN_LIMIT_MESSAGE };
  }
  return (await getBalance(userId)) >= 1 ? { ok: true } : { ok: false, error: NO_CREDIT_MESSAGE };
}
