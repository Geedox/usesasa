import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getSession } from "@/lib/get-session";
import { db } from "@/lib/db";
import { applications } from "@/lib/db/schema";

// Save edits to a tailored application (owner only).
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const { id } = await params;

  const body = (await req.json().catch(() => ({}))) as {
    tailoredCv?: unknown;
    coverLetterText?: string;
    customAnswers?: unknown;
  };

  const updated = await db
    .update(applications)
    .set({
      ...(body.tailoredCv !== undefined ? { tailoredCv: body.tailoredCv } : {}),
      ...(body.coverLetterText !== undefined ? { coverLetterText: body.coverLetterText } : {}),
      ...(body.customAnswers !== undefined ? { customAnswers: body.customAnswers } : {}),
    })
    .where(and(eq(applications.id, id), eq(applications.userId, session.user.id)))
    .returning({ id: applications.id });

  if (updated.length === 0) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
