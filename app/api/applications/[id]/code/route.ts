import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getSession } from "@/lib/get-session";
import { db } from "@/lib/db";
import { applications } from "@/lib/db/schema";
import { resumeWithCode } from "@/lib/submit/steel";

// The user supplies the email verification code for a paused application; we type
// it into the live cloud browser, submit, and confirm.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const { id } = await params;
  const { code } = (await req.json().catch(() => ({}))) as { code?: string };
  if (!code || !/\w/.test(code)) return NextResponse.json({ error: "Enter the code." }, { status: 400 });

  const app = await db.query.applications.findFirst({
    where: and(eq(applications.id, id), eq(applications.userId, session.user.id)),
  });
  if (!app) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (!app.awaitingCode) return NextResponse.json({ error: "This application is not waiting for a code." }, { status: 400 });

  const r = await resumeWithCode(id, code);
  return NextResponse.json({ ok: r.result === "submitted", result: r.result, reason: r.reason });
}
