import { NextResponse } from "next/server";
import { and, desc, eq, inArray } from "drizzle-orm";
import { getSession } from "@/lib/get-session";
import { db } from "@/lib/db";
import { mentorApplications } from "@/lib/db/schema";

// Apply to become a mentor. We collect a resume link, LinkedIn, other links and a
// short pitch. The application stays pending until an admin approves or rejects it.
// A user may re-apply after a rejection, but not while one is pending/approved.
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const userId = session.user.id;

  const body = (await req.json().catch(() => ({}))) as {
    photoUrl?: string;
    resumeUrl?: string;
    linkedinUrl?: string;
    otherLinks?: string;
    pitch?: string;
  };

  const photoUrl = body.photoUrl?.trim() || null;
  const resumeUrl = body.resumeUrl?.trim() || null;
  const linkedinUrl = body.linkedinUrl?.trim() || null;
  const pitch = body.pitch?.trim().slice(0, 4000) || null;
  const otherLinks = (body.otherLinks || "")
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 10);

  if (!resumeUrl && !linkedinUrl) {
    return NextResponse.json({ error: "Add a resume link or your LinkedIn so we can review you." }, { status: 400 });
  }
  if (!pitch) {
    return NextResponse.json({ error: "Tell us briefly why you would be a great mentor." }, { status: 400 });
  }

  const open = await db
    .select({ id: mentorApplications.id })
    .from(mentorApplications)
    .where(and(eq(mentorApplications.userId, userId), inArray(mentorApplications.status, ["pending", "approved"])))
    .orderBy(desc(mentorApplications.createdAt))
    .limit(1);
  if (open.length) {
    return NextResponse.json({ error: "You already have an application in review or approved." }, { status: 409 });
  }

  await db.insert(mentorApplications).values({ userId, photoUrl, resumeUrl, linkedinUrl, otherLinks, pitch });
  return NextResponse.json({ ok: true });
}
