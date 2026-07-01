import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getAdminSession } from "@/lib/admin";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { adminAdjustCredits } from "@/lib/credits";

// Admin grants (+) or deducts (-) credits for a user. A deduction is clamped so the
// balance never goes below 0.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  const { id } = await params;

  const body = (await req.json().catch(() => ({}))) as { delta?: number };
  const delta = Math.trunc(Number(body.delta));
  if (!Number.isFinite(delta) || delta === 0) {
    return NextResponse.json({ error: "Enter a non-zero whole number." }, { status: 400 });
  }
  if (Math.abs(delta) > 100000) {
    return NextResponse.json({ error: "That adjustment looks too large." }, { status: 400 });
  }

  const target = await db.query.users.findFirst({ where: eq(users.id, id), columns: { id: true } });
  if (!target) return NextResponse.json({ error: "User not found." }, { status: 404 });

  const balance = await adminAdjustCredits(id, delta);
  return NextResponse.json({ ok: true, balance });
}
