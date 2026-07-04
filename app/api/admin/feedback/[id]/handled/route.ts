import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getAdminSession } from "@/lib/admin";
import { db } from "@/lib/db";
import { feedback } from "@/lib/db/schema";

// Admin marks a piece of feedback as reviewed (or un-reviews it).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  const { id } = await params;

  const { handled } = (await req.json().catch(() => ({}))) as { handled?: boolean };
  const updated = await db
    .update(feedback)
    .set({ handledAt: handled ? new Date() : null })
    .where(eq(feedback.id, id))
    .returning({ id: feedback.id });
  if (!updated.length) return NextResponse.json({ error: "Not found." }, { status: 404 });

  return NextResponse.json({ ok: true, handled: !!handled });
}
