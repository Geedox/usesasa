import { NextResponse } from "next/server";
import { and, eq, ne } from "drizzle-orm";
import { getSession } from "@/lib/get-session";
import { db } from "@/lib/db";
import { applications, jobs, companies, matches } from "@/lib/db/schema";
import { canUseSasa } from "@/lib/can-use";
import { isSubscriber } from "@/lib/subscription";
import { chargeForSubmission } from "@/lib/credits";
import { applyUrlFor } from "@/lib/submit/input";

// Manual apply straight from a match card (bot-walled / aggregator jobs). Finds or
// creates the application, charges 1 credit once (credits users), marks it submitted,
// and returns the job link to open in the user's own browser.
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const { jobId } = (await req.json().catch(() => ({}))) as { jobId?: string };
  if (!jobId) return NextResponse.json({ error: "Missing jobId." }, { status: 400 });

  const job = await db.query.jobs.findFirst({ where: eq(jobs.id, jobId) });
  if (!job) return NextResponse.json({ error: "Job not found." }, { status: 404 });
  const company = await db.query.companies.findFirst({ where: eq(companies.id, job.companyId) });
  const url =
    applyUrlFor({ jobUrl: job.url, jobSource: job.source, jobExternalId: job.externalId, companySlug: company?.atsSlug ?? null }) ||
    job.url;
  if (!url) return NextResponse.json({ error: "This job has no link to open." }, { status: 400 });

  // Existing application for this job?
  const existing = await db.query.applications.findFirst({
    where: and(eq(applications.userId, session.user.id), eq(applications.jobId, jobId)),
  });
  if (existing?.state === "submitted") return NextResponse.json({ ok: true, url });

  const can = await canUseSasa(session.user.id);
  if (!can.ok) return NextResponse.json({ error: can.error }, { status: 402 });

  // Ensure an application row exists (dedup-safe on the user+job unique constraint).
  let appId = existing?.id;
  if (!appId) {
    const match = await db.query.matches.findFirst({
      where: and(eq(matches.userId, session.user.id), eq(matches.jobId, jobId)),
    });
    const [created] = await db
      .insert(applications)
      .values({ userId: session.user.id, jobId, matchId: match?.id ?? null, state: "drafted" })
      .onConflictDoNothing({ target: [applications.userId, applications.jobId] })
      .returning({ id: applications.id });
    appId =
      created?.id ??
      (await db.query.applications.findFirst({
        where: and(eq(applications.userId, session.user.id), eq(applications.jobId, jobId)),
      }))?.id;
  }
  if (!appId) return NextResponse.json({ error: "Could not create the application." }, { status: 500 });

  const subscriber = await isSubscriber(session.user.id);
  const won = await db
    .update(applications)
    .set({
      state: "submitted",
      submittedAt: new Date(),
      submittedVia: "manual",
      creditsCharged: subscriber ? 0 : 1,
      pipelineStatus: "applied",
      pipelineUpdatedAt: new Date(),
      submissionNote: "Applied manually in your own browser.",
      awaitingCode: false,
    })
    .where(and(eq(applications.id, appId), ne(applications.state, "submitted")))
    .returning({ id: applications.id });
  if (won.length && !subscriber) await chargeForSubmission(session.user.id, appId);

  return NextResponse.json({ ok: true, url });
}
