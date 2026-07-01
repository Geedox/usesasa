import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getAdminSession } from "@/lib/admin";
import { db } from "@/lib/db";
import { mentorApplications, mentors, users } from "@/lib/db/schema";
import { notifyMentorApplicationDecision } from "@/lib/interview/notify";

// Admin approves or rejects a mentor application. Approving creates (or reactivates)
// a mentor row for that user, with the Cal link / title / expertise the admin sets.
// Rejecting stores a reason the applicant can see and re-apply against.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  const { id } = await params;

  const body = (await req.json().catch(() => ({}))) as {
    decision?: "approve" | "reject";
    reason?: string;
    calLink?: string;
    title?: string;
    expertise?: string;
    sortOrder?: number;
  };

  const appRow = await db.query.mentorApplications.findFirst({ where: eq(mentorApplications.id, id) });
  if (!appRow) return NextResponse.json({ error: "Application not found." }, { status: 404 });

  if (body.decision === "approve") {
    const applicant = await db.query.users.findFirst({ where: eq(users.id, appRow.userId) });
    if (!applicant) return NextResponse.json({ error: "Applicant not found." }, { status: 404 });

    const expertise = (body.expertise || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const existing = await db.query.mentors.findFirst({ where: eq(mentors.userId, appRow.userId) });
    if (existing) {
      await db
        .update(mentors)
        .set({
          active: true,
          calLink: body.calLink?.trim() || existing.calLink,
          title: body.title?.trim() || existing.title,
          expertise: expertise.length ? expertise : existing.expertise,
          sortOrder: body.sortOrder ?? existing.sortOrder,
        })
        .where(eq(mentors.id, existing.id));
    } else {
      await db.insert(mentors).values({
        userId: appRow.userId,
        name: applicant.name || applicant.email,
        title: body.title?.trim() || null,
        expertise: expertise.length ? expertise : null,
        photoUrl: appRow.photoUrl || applicant.image || null,
        calLink: body.calLink?.trim() || null,
        sortOrder: body.sortOrder ?? 0,
        active: true,
      });
    }

    await db
      .update(mentorApplications)
      .set({ status: "approved", reviewedBy: admin.user.id, reviewedAt: new Date(), updatedAt: new Date() })
      .where(eq(mentorApplications.id, id));

    await notifyMentorApplicationDecision(id);
    return NextResponse.json({ ok: true });
  }

  if (body.decision === "reject") {
    if (!body.reason?.trim()) return NextResponse.json({ error: "Give a reason so the applicant can improve." }, { status: 400 });
    await db
      .update(mentorApplications)
      .set({ status: "rejected", rejectionReason: body.reason.trim().slice(0, 2000), reviewedBy: admin.user.id, reviewedAt: new Date(), updatedAt: new Date() })
      .where(eq(mentorApplications.id, id));

    await notifyMentorApplicationDecision(id);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown decision." }, { status: 400 });
}
