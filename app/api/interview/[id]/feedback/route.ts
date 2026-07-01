import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getSession } from "@/lib/get-session";
import { db } from "@/lib/db";
import { interviewBookings, mentors } from "@/lib/db/schema";
import { notifyFeedbackReady } from "@/lib/interview/notify";

// A mentor submits an honest score (0-100) and written feedback for a call they were
// assigned. Only the mentor assigned to the booking can post it. Marks the session
// completed and notifies the interviewee.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const { id } = await params;

  const mentor = await db.query.mentors.findFirst({ where: eq(mentors.userId, session.user.id) });
  if (!mentor) return NextResponse.json({ error: "You are not a mentor." }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as { score?: number; feedback?: string };
  const score = Number(body.score);
  if (!Number.isFinite(score) || score < 0 || score > 100) {
    return NextResponse.json({ error: "Score must be a number from 0 to 100." }, { status: 400 });
  }
  const feedback = (body.feedback || "").trim();
  if (!feedback) return NextResponse.json({ error: "Add written feedback for the candidate." }, { status: 400 });

  const updated = await db
    .update(interviewBookings)
    .set({
      feedbackScore: Math.round(score),
      feedbackText: feedback.slice(0, 8000),
      feedbackAt: new Date(),
      status: "completed",
      updatedAt: new Date(),
    })
    .where(and(eq(interviewBookings.id, id), eq(interviewBookings.mentorId, mentor.id)))
    .returning({ id: interviewBookings.id });

  if (!updated.length) return NextResponse.json({ error: "That booking is not assigned to you." }, { status: 404 });

  await notifyFeedbackReady(id);
  return NextResponse.json({ ok: true });
}
