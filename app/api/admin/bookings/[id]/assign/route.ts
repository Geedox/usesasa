import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getAdminSession } from "@/lib/admin";
import { db } from "@/lib/db";
import { interviewBookings, mentors } from "@/lib/db/schema";
import { notifyMentorAssigned } from "@/lib/interview/notify";

// Admin assigns an approved mentor to a booking. Notifies the interviewee.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  const { id } = await params;

  const body = (await req.json().catch(() => ({}))) as { mentorId?: string };
  if (!body.mentorId) return NextResponse.json({ error: "Pick a mentor." }, { status: 400 });

  const mentor = await db.query.mentors.findFirst({ where: eq(mentors.id, body.mentorId) });
  if (!mentor) return NextResponse.json({ error: "Mentor not found." }, { status: 404 });

  const updated = await db
    .update(interviewBookings)
    .set({ mentorId: mentor.id, updatedAt: new Date() })
    .where(eq(interviewBookings.id, id))
    .returning({ id: interviewBookings.id });
  if (!updated.length) return NextResponse.json({ error: "Booking not found." }, { status: 404 });

  await notifyMentorAssigned(id);
  return NextResponse.json({ ok: true });
}
