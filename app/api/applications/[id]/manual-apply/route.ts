import { NextResponse } from "next/server";
import { and, eq, ne } from "drizzle-orm";
import { getSession } from "@/lib/get-session";
import { db } from "@/lib/db";
import { applications, jobs, companies } from "@/lib/db/schema";
import { canUseSasa } from "@/lib/can-use";
import { isSubscriber } from "@/lib/subscription";
import { chargeForSubmission } from "@/lib/credits";
import { applyUrlFor } from "@/lib/submit/input";

// Manual apply: when the cloud browser can't get through (e.g. a Cloudflare bot wall),
// the user applies in their own browser. Charges 1 credit once (credits users), marks
// the application submitted, and returns the job link to open in a new tab.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const { id } = await params;

  const app = await db.query.applications.findFirst({
    where: and(eq(applications.id, id), eq(applications.userId, session.user.id)),
  });
  if (!app) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const job = await db.query.jobs.findFirst({ where: eq(jobs.id, app.jobId) });
  if (!job) return NextResponse.json({ error: "Job not found." }, { status: 404 });
  const company = await db.query.companies.findFirst({ where: eq(companies.id, job.companyId) });
  const url =
    applyUrlFor({ jobUrl: job.url, jobSource: job.source, jobExternalId: job.externalId, companySlug: company?.atsSlug ?? null }) ||
    job.url;
  if (!url) return NextResponse.json({ error: "This job has no link to open." }, { status: 400 });

  // Already submitted — just hand back the link, no charge.
  if (app.state === "submitted") return NextResponse.json({ ok: true, url });

  const can = await canUseSasa(session.user.id);
  if (!can.ok) return NextResponse.json({ error: can.error }, { status: 402 });

  const subscriber = await isSubscriber(session.user.id);
  // Mark submitted once (guards against a double-charge), then charge credits users.
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
    .where(and(eq(applications.id, id), ne(applications.state, "submitted")))
    .returning({ id: applications.id });
  if (won.length && !subscriber) await chargeForSubmission(session.user.id, id);

  return NextResponse.json({ ok: true, url });
}
