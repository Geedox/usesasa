import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { paystackTransactions, subscriptions } from "@/lib/db/schema";
import { addCredits } from "@/lib/credits";
import { rewardReferralForPack } from "@/lib/referral";
import { verifyWebhook } from "@/lib/paystack";

const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;

// Activate (or extend) a subscription for the user named in the charge metadata.
async function activateSubscription(data: Record<string, unknown>) {
  const meta = (data.metadata as Record<string, unknown>) ?? {};
  const userId = typeof meta.userId === "string" ? meta.userId : null;
  const planId = typeof meta.planId === "string" ? meta.planId : null;
  if (!userId || !planId) return;
  const now = new Date();
  const end = new Date(now.getTime() + THIRTY_DAYS);
  const customer = (data.customer as { customer_code?: string } | undefined)?.customer_code ?? null;
  await db
    .insert(subscriptions)
    .values({ userId, planId, status: "active", paystackCustomerCode: customer, currentPeriodStart: now, currentPeriodEnd: end })
    .onConflictDoUpdate({
      target: subscriptions.userId,
      set: { planId, status: "active", currentPeriodStart: now, currentPeriodEnd: end, updatedAt: now },
    });
}

// Paystack webhook — the source of truth for crediting a purchase. Verifies the
// HMAC-SHA512 signature, then on charge.success credits the pack's credits exactly
// once (idempotent on the transaction reference).
export async function POST(req: Request) {
  const raw = await req.text();
  if (!verifyWebhook(raw, req.headers.get("x-paystack-signature"))) {
    return NextResponse.json({ error: "Bad signature." }, { status: 401 });
  }

  let event: { event?: string; data?: { reference?: string; metadata?: Record<string, unknown> } };
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  // Subscription lifecycle.
  if (event.event === "subscription.disable" || event.event === "subscription.not_renew") {
    const code = (event.data as { subscription_code?: string })?.subscription_code;
    if (code) {
      await db.update(subscriptions).set({ status: "cancelled", updatedAt: new Date() }).where(eq(subscriptions.paystackSubscriptionCode, code));
    }
    return NextResponse.json({ ok: true });
  }

  if (event.event !== "charge.success") return NextResponse.json({ ok: true, ignored: event.event });

  // A subscription charge (initial or renewal) carries a real plan code. NOTE:
  // Paystack includes `plan: {}` (empty object) on ordinary one-off charges too, and
  // {} is truthy — so we must check for an actual plan_code, not just `data.plan`,
  // otherwise credit-pack payments get misrouted here and never credited.
  const data = (event.data as Record<string, unknown>) ?? {};
  const meta = (data.metadata as Record<string, unknown>) ?? {};
  const planObj = data.plan;
  const planCode =
    planObj && typeof planObj === "object" ? (planObj as { plan_code?: string }).plan_code : typeof planObj === "string" ? planObj : "";
  if (meta.kind === "subscription" || (planCode && planCode.length > 0)) {
    await activateSubscription(data);
    return NextResponse.json({ ok: true });
  }

  const reference = event.data?.reference;
  if (!reference) return NextResponse.json({ ok: true, skipped: "no reference" });

  const tx = await db.query.paystackTransactions.findFirst({ where: eq(paystackTransactions.paystackReference, reference) });
  if (!tx) return NextResponse.json({ ok: true, skipped: "unknown reference" });
  if (tx.status === "success") return NextResponse.json({ ok: true, skipped: "already credited" });

  const credits = tx.creditsPurchased ?? 0;
  // relatedId is a uuid column — use the transaction's id, not the Paystack reference string.
  if (credits > 0) await addCredits(tx.userId, credits, "paystack_purchase", tx.id);

  await db
    .update(paystackTransactions)
    .set({ status: "success", rawWebhook: event as Record<string, unknown> })
    .where(eq(paystackTransactions.id, tx.id));

  // Referral milestone: if this buyer was referred, reward the referrer for the
  // ₦15k / ₦30k pack (once each). packId comes from the charge metadata.
  await rewardReferralForPack(tx.userId, typeof meta.packId === "string" ? meta.packId : undefined);

  return NextResponse.json({ ok: true });
}
