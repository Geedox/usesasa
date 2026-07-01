import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getSession } from "@/lib/get-session";
import { db } from "@/lib/db";
import { applications, jobs, matches } from "@/lib/db/schema";
import { enqueueTailorApplication } from "@/lib/queue";

// "Apply" on a match: create (or reuse) a draft application for the job and
// enqueue tailoring. No credits charged (credits debit only on submission).
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const { jobId } = (await req.json().catch(() => ({}))) as { jobId?: string };
  if (!jobId) return NextResponse.json({ error: "Missing job." }, { status: 400 });

  const job = await db.query.jobs.findFirst({ where: eq(jobs.id, jobId) });
  if (!job) return NextResponse.json({ error: "Job not found." }, { status: 404 });

  // Reuse an existing application for this (user, job) if present.
  let app = await db.query.applications.findFirst({
    where: and(eq(applications.userId, session.user.id), eq(applications.jobId, jobId)),
  });

  if (!app) {
    const match = await db.query.matches.findFirst({
      where: and(eq(matches.userId, session.user.id), eq(matches.jobId, jobId)),
    });
    const [created] = await db
      .insert(applications)
      .values({ userId: session.user.id, jobId, matchId: match?.id ?? null, state: "drafted" })
      .onConflictDoNothing({ target: [applications.userId, applications.jobId] })
      .returning();
    // If a concurrent request already created it, fetch that row instead.
    app =
      created ??
      (await db.query.applications.findFirst({
        where: and(eq(applications.userId, session.user.id), eq(applications.jobId, jobId)),
      }));
  }
  if (!app) return NextResponse.json({ error: "Could not create application." }, { status: 500 });

  await enqueueTailorApplication({ applicationId: app.id });
  return NextResponse.json({ ok: true, applicationId: app.id });
}
