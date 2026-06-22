import { and, desc, eq } from "drizzle-orm";
import { getSession } from "@/lib/get-session";
import { db } from "@/lib/db";
import { applications, jobs, companies } from "@/lib/db/schema";
import { TrackerBoard, type TrackerCard, type Column } from "@/components/dashboard/tracker-board";
import { CreditGate } from "@/components/dashboard/credit-gate";
import { canUseSasa } from "@/lib/can-use";

const THIRTY_DAYS = 30 * 86400000;

// Map an application's pipeline status (+ age) to a tracker column.
function columnFor(pipelineStatus: string | null, submittedAt: Date | null): Column {
  switch (pipelineStatus) {
    case "rejected":
      return "rejected";
    case "interview":
    case "offer":
    case "replied":
      return "interviewing";
    default: {
      // applied / viewed / none: ghosted once it has been silent for 30+ days.
      const age = submittedAt ? Date.now() - submittedAt.getTime() : 0;
      return age > THIRTY_DAYS ? "ghosted" : "applied";
    }
  }
}

export default async function TrackerPage() {
  const session = await getSession();
  if (!session) return null;

  const rows = await db
    .select({
      id: applications.id,
      pipelineStatus: applications.pipelineStatus,
      submittedAt: applications.submittedAt,
      jobUrl: jobs.url,
      title: jobs.title,
      company: companies.name,
      logoUrl: companies.logoUrl,
    })
    .from(applications)
    .innerJoin(jobs, eq(applications.jobId, jobs.id))
    .innerJoin(companies, eq(jobs.companyId, companies.id))
    .where(and(eq(applications.userId, session.user.id), eq(applications.state, "submitted")))
    .orderBy(desc(applications.submittedAt));

  const cards: TrackerCard[] = rows.map((r) => ({
    id: r.id,
    company: r.company,
    logoUrl: r.logoUrl,
    title: r.title,
    jobUrl: r.jobUrl,
    submittedAt: r.submittedAt ? r.submittedAt.toISOString() : null,
    column: columnFor(r.pipelineStatus, r.submittedAt),
  }));

  const blocked = !(await canUseSasa(session.user.id)).ok;

  return (
    <CreditGate blocked={blocked}>
      <TrackerBoard cards={cards} />
    </CreditGate>
  );
}
