import { NextResponse } from "next/server";
import { getSession } from "@/lib/get-session";
import { getPlan } from "@/lib/plans";
import { initSubscription, paystackConfigured } from "@/lib/paystack";

const BASE = (process.env.BETTER_AUTH_URL || "http://localhost:3000").replace(/\/$/, "");

// Start an international subscription (Nigeria uses credit packs instead). Returns
// the Paystack checkout URL; the webhook activates the plan once payment succeeds.
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  if (!paystackConfigured()) return NextResponse.json({ error: "Payments are not configured yet." }, { status: 503 });

  const { planId } = (await req.json().catch(() => ({}))) as { planId?: string };
  const plan = planId ? getPlan(planId) : undefined;
  if (!plan) return NextResponse.json({ error: "Unknown plan." }, { status: 400 });
  if (!plan.paystackPlanCode) return NextResponse.json({ error: "This plan is not configured yet." }, { status: 503 });

  const init = await initSubscription({
    email: session.user.email,
    planCode: plan.paystackPlanCode,
    callbackUrl: `${BASE}/dashboard/settings?tab=billing&payment=done`,
    metadata: { userId: session.user.id, planId: plan.id, kind: "subscription" },
  });
  if (!init.authorization_url) return NextResponse.json({ error: init.error || "Could not start subscription." }, { status: 502 });

  return NextResponse.json({ ok: true, url: init.authorization_url });
}
