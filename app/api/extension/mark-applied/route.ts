import { NextResponse } from "next/server";
import { and, eq, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import { companies, jobs, applications } from "@/lib/db/schema";
import { userFromBearer } from "@/lib/extension-auth";
import { canUseSasa } from "@/lib/can-use";
import { isSubscriber } from "@/lib/subscription";
import { chargeForSubmission } from "@/lib/credits";

// Mark a job the user applied to via the extension (quick fill / tailor + submit) as
// applied. Finds or creates the ad-hoc job + application, charges 1 credit (credits
// users), and sets it submitted so the dashboard shows it as applied.
export async function POST(req: Request) {
  const user = await userFromBearer(req);
  if (!user) return NextResponse.json({ error: "Invalid token." }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { title?: string; company?: string; url?: string };
  const title = body.title?.trim().slice(0, 200) || "Role";
  const company = body.company?.trim().slice(0, 120) || "Company";
  const url = body.url?.trim().slice(0, 500) || "";
  if (!url) return NextResponse.json({ error: "No job link to mark." }, { status: 400 });

  const slug = (() => { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return company.toLowerCase(); } })();
  await db.insert(companies).values({ name: company, ats: "custom", atsSlug: slug }).onConflictDoNothing({ target: [companies.ats, companies.atsSlug] });
  const companyRow = await db.query.companies.findFirst({ where: and(eq(companies.ats, "custom"), eq(companies.atsSlug, slug)) });
  if (!companyRow) return NextResponse.json({ error: "Could not record the job." }, { status: 500 });

  const externalId = url || `${slug}:${title}`;
  await db.insert(jobs).values({ companyId: companyRow.id, source: "custom", externalId, title, url }).onConflictDoNothing({ target: [jobs.source, jobs.externalId] });
  const jobRow = await db.query.jobs.findFirst({ where: and(eq(jobs.source, "custom"), eq(jobs.externalId, externalId)) });
  if (!jobRow) return NextResponse.json({ error: "Could not record the job." }, { status: 500 });

  const existing = await db.query.applications.findFirst({ where: and(eq(applications.userId, user.id), eq(applications.jobId, jobRow.id)) });
  if (existing?.state === "submitted") return NextResponse.json({ ok: true, alreadyApplied: true });

  const can = await canUseSasa(user.id);
  if (!can.ok) return NextResponse.json({ error: can.error }, { status: 402 });

  if (!existing) {
    await db.insert(applications).values({ userId: user.id, jobId: jobRow.id, state: "drafted" }).onConflictDoNothing({ target: [applications.userId, applications.jobId] });
  }
  const app = existing ?? (await db.query.applications.findFirst({ where: and(eq(applications.userId, user.id), eq(applications.jobId, jobRow.id)) }));
  if (!app) return NextResponse.json({ error: "Could not mark applied." }, { status: 500 });

  const subscriber = await isSubscriber(user.id);
  const won = await db
    .update(applications)
    .set({
      state: "submitted",
      submittedAt: new Date(),
      submittedVia: "extension",
      creditsCharged: subscriber ? 0 : 1,
      pipelineStatus: "applied",
      pipelineUpdatedAt: new Date(),
      submissionNote: "Applied via the browser extension.",
      awaitingCode: false,
    })
    .where(and(eq(applications.id, app.id), ne(applications.state, "submitted")))
    .returning({ id: applications.id });
  if (won.length && !subscriber) await chargeForSubmission(user.id, app.id);

  return NextResponse.json({ ok: true });
}
