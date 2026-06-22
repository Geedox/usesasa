import { and, count, eq, gte } from "drizzle-orm";
import { db } from "@/lib/db";
import { subscriptions, applications } from "@/lib/db/schema";
import { allowanceFor } from "@/lib/plans";

// The active subscription row for a user, or null. International users subscribe;
// Nigerians stay on credits and never have one.
export async function activeSubscription(userId: string) {
  const sub = await db.query.subscriptions.findFirst({ where: eq(subscriptions.userId, userId) });
  if (!sub || sub.status !== "active") return null;
  if (sub.currentPeriodEnd && sub.currentPeriodEnd.getTime() < Date.now()) return null; // lapsed
  return sub;
}

export type Entitlement = { planId: string | null; allowance: number; used: number; remaining: number; periodStart: Date };

// Applications used in the current cycle and how many remain. For subscribers the
// cycle is their billing period; otherwise a rolling 30-day window.
export async function getEntitlement(userId: string): Promise<Entitlement> {
  const sub = await activeSubscription(userId);
  const periodStart =
    sub?.currentPeriodStart ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const allowance = allowanceFor(sub?.planId ?? null);

  const [row] = await db
    .select({ n: count() })
    .from(applications)
    .where(and(eq(applications.userId, userId), eq(applications.state, "submitted"), gte(applications.submittedAt, periodStart)));
  const used = row?.n ?? 0;

  return { planId: sub?.planId ?? null, allowance, used, remaining: Math.max(0, allowance - used), periodStart };
}

// Whether the user is metered by a subscription (true) or pays with credits (false).
export async function isSubscriber(userId: string): Promise<boolean> {
  return (await activeSubscription(userId)) !== null;
}
