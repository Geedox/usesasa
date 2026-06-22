import { NextResponse } from "next/server";
import { getSession } from "@/lib/get-session";
import { db } from "@/lib/db";
import { paystackTransactions } from "@/lib/db/schema";
import { getPack, initTransaction, paystackConfigured } from "@/lib/paystack";

const BASE = (process.env.BETTER_AUTH_URL || "http://localhost:3000").replace(/\/$/, "");

// Start a credit-pack purchase: create a Paystack transaction and return the hosted
// checkout URL. The webhook credits the user once payment succeeds.
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  if (!paystackConfigured()) return NextResponse.json({ error: "Payments are not configured yet." }, { status: 503 });

  const { packId } = (await req.json().catch(() => ({}))) as { packId?: string };
  const pack = packId ? getPack(packId) : undefined;
  if (!pack) return NextResponse.json({ error: "Unknown pack." }, { status: 400 });

  const init = await initTransaction({
    email: session.user.email,
    amount: pack.amount,
    currency: pack.currency,
    callbackUrl: `${BASE}/dashboard/settings?tab=billing&payment=done`,
    metadata: { userId: session.user.id, packId: pack.id, credits: pack.credits },
  });
  if (!init.authorization_url || !init.reference) {
    return NextResponse.json({ error: init.error || "Could not start checkout." }, { status: 502 });
  }

  await db.insert(paystackTransactions).values({
    userId: session.user.id,
    paystackReference: init.reference,
    amountKobo: pack.amount,
    status: "pending",
    creditsPurchased: pack.credits,
  });

  return NextResponse.json({ ok: true, url: init.authorization_url });
}
