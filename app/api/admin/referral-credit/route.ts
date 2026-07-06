import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getAdminSession } from "@/lib/admin";
import { db } from "@/lib/db";
import { users, referrals } from "@/lib/db/schema";
import { addCredits, getBalance } from "@/lib/credits";

// Admin backfill for a missed referral: enter the referrer's CODE, the referred user's
// EMAIL, and an amount. Credits the referrer (the code owner) and records the referral
// link so milestone rewards track going forward.
export async function POST(req: Request) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Not authorized." }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as { code?: string; email?: string; amount?: number };
  const code = (body.code ?? "").trim().toUpperCase();
  const email = (body.email ?? "").trim().toLowerCase();
  const amount = Math.trunc(Number(body.amount));

  if (!code) return NextResponse.json({ error: "Enter the referral code." }, { status: 400 });
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1000) {
    return NextResponse.json({ error: "Enter a valid amount (1 to 1000)." }, { status: 400 });
  }

  // The referrer owns the code and receives the credit.
  const referrer = await db.query.users.findFirst({ where: eq(users.referralCode, code) });
  if (!referrer) return NextResponse.json({ error: `No user owns the code "${code}".` }, { status: 404 });

  // Optionally link the referred user (by email) so the referrals record exists.
  let referralId: string | undefined;
  let referredNote = "";
  if (email) {
    const referred = await db.query.users.findFirst({ where: eq(users.email, email) });
    if (!referred) return NextResponse.json({ error: `No user with email "${email}".` }, { status: 404 });
    if (referred.id === referrer.id) return NextResponse.json({ error: "That email owns the code (self-referral)." }, { status: 400 });

    const existing = await db.query.referrals.findFirst({ where: eq(referrals.referredId, referred.id) });
    if (existing) {
      referralId = existing.id;
      referredNote = " (referral already recorded)";
    } else {
      const [row] = await db
        .insert(referrals)
        .values({ referrerId: referrer.id, referredId: referred.id, code, rewardedSignup: true })
        .onConflictDoNothing({ target: referrals.referredId })
        .returning({ id: referrals.id });
      referralId = row?.id;
    }
  }

  const balance = await addCredits(referrer.id, amount, "referral_bonus", referralId);

  return NextResponse.json({
    ok: true,
    referrerEmail: referrer.email,
    granted: amount,
    balance,
    message: `Credited ${amount} to ${referrer.email}${referredNote}. New balance: ${balance}.`,
  });
}

// Look up who owns a code (so the admin can confirm before crediting).
export async function GET(req: Request) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  const code = (new URL(req.url).searchParams.get("code") ?? "").trim().toUpperCase();
  if (!code) return NextResponse.json({ error: "Missing code." }, { status: 400 });
  const referrer = await db.query.users.findFirst({
    where: eq(users.referralCode, code),
    columns: { id: true, email: true, name: true },
  });
  if (!referrer) return NextResponse.json({ found: false });
  return NextResponse.json({ found: true, email: referrer.email, name: referrer.name, balance: await getBalance(referrer.id) });
}
