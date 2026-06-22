import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { companies, jobs, applications, profiles } from "@/lib/db/schema";
import { userFromBearer } from "@/lib/extension-auth";
import { canUseSasa } from "@/lib/can-use";
import { enqueueTailorApplication } from "@/lib/queue";

// "Tailor to this job" from the universal widget. We record the scraped page as an
// external job + application, then QUEUE the tailoring (so the user can leave the
// page — the worker tailors, charges the credit, and pings them when ready). The
// widget polls /api/extension/tailor-result for the finished CV + cover.
export async function POST(req: Request) {
  const user = await userFromBearer(req);
  if (!user) return NextResponse.json({ error: "Invalid token." }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { title?: string; company?: string; jd?: string; url?: string; embellish?: boolean };
  const title = body.title?.trim().slice(0, 200) || "Role";
  const company = body.company?.trim().slice(0, 120) || "Company";
  const jd = body.jd?.trim().slice(0, 8000) || "";
  const url = body.url?.trim().slice(0, 500) || "";
  if (!jd && !url) return NextResponse.json({ error: "Could not read this job page." }, { status: 400 });

  const profileRow = await db.query.profiles.findFirst({ where: and(eq(profiles.userId, user.id), eq(profiles.isCurrent, true)) });
  if (!profileRow?.parsedData) return NextResponse.json({ error: "Finish onboarding (upload your CV) first." }, { status: 422 });

  // Credit / plan gate for instant feedback (the worker also gates).
  const can = await canUseSasa(user.id);
  if (!can.ok) return NextResponse.json({ error: can.error }, { status: 402 });

  const slug = (() => { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return company.toLowerCase(); } })();
  await db.insert(companies).values({ name: company, ats: "custom", atsSlug: slug }).onConflictDoNothing({ target: [companies.ats, companies.atsSlug] });
  const companyRow = await db.query.companies.findFirst({ where: and(eq(companies.ats, "custom"), eq(companies.atsSlug, slug)) });
  if (!companyRow) return NextResponse.json({ error: "Could not record the job." }, { status: 500 });

  const externalId = url || `${slug}:${title}`;
  await db
    .insert(jobs)
    .values({ companyId: companyRow.id, source: "custom", externalId, title, url, rawJd: jd })
    .onConflictDoUpdate({ target: [jobs.source, jobs.externalId], set: { title, rawJd: jd } });
  const jobRow = await db.query.jobs.findFirst({ where: and(eq(jobs.source, "custom"), eq(jobs.externalId, externalId)) });
  if (!jobRow) return NextResponse.json({ error: "Could not record the job." }, { status: 500 });

  await db.insert(applications).values({ userId: user.id, jobId: jobRow.id, state: "drafted" }).onConflictDoNothing({ target: [applications.userId, applications.jobId] });
  const appRow = await db.query.applications.findFirst({ where: and(eq(applications.userId, user.id), eq(applications.jobId, jobRow.id)) });
  if (!appRow) return NextResponse.json({ error: "Could not start the application." }, { status: 500 });

  // Queue it — the worker tailors, charges, and notifies when ready. The widget's
  // honesty toggle can flip embellishment on for this one tailor (overrides saved).
  await enqueueTailorApplication({ applicationId: appRow.id, embellish: body.embellish === true ? true : undefined });

  return NextResponse.json({ ok: true, applicationId: appRow.id });
}
