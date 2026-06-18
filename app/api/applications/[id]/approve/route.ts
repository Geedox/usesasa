import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getSession } from "@/lib/get-session";
import { db } from "@/lib/db";
import { applications } from "@/lib/db/schema";

// Approve a reviewed application -> queued (the extension submits later). No send here.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const { id } = await params;

  const updated = await db
    .update(applications)
    .set({ state: "queued" })
    .where(and(eq(applications.id, id), eq(applications.userId, session.user.id)))
    .returning({ id: applications.id });

  if (updated.length === 0) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
