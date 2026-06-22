import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { getSession } from "@/lib/get-session";
import { db } from "@/lib/db";
import { applications, jobs, companies } from "@/lib/db/schema";
import { ApplicationReview } from "@/components/applications/review";
import { ApplicationProcessing } from "@/components/applications/processing";

type RoleCv = { company: string; title: string; originalTitle?: string; originalBullets: string[]; rewrittenBullets: string[] };

export default async function ApplicationReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return null;

  const [row] = await db
    .select({
      id: applications.id,
      userId: applications.userId,
      state: applications.state,
      tailoredCv: applications.tailoredCv,
      coverLetterText: applications.coverLetterText,
      customAnswers: applications.customAnswers,
      tailoringValidation: applications.tailoringValidation,
      submissionNote: applications.submissionNote,
      submissionViewUrl: applications.submissionViewUrl,
      awaitingCode: applications.awaitingCode,
      submissionLog: applications.submissionLog,
      jobTitle: jobs.title,
      jobLocation: jobs.location,
      company: companies.name,
    })
    .from(applications)
    .innerJoin(jobs, eq(applications.jobId, jobs.id))
    .innerJoin(companies, eq(jobs.companyId, companies.id))
    .where(and(eq(applications.id, id), eq(applications.userId, session.user.id)))
    .limit(1);

  if (!row) notFound();

  if (row.state === "drafted") {
    return <ApplicationProcessing title={row.jobTitle} />;
  }

  const cv = row.tailoredCv as { experience?: RoleCv[]; summary?: string; skills?: string[] } | null;
  const experience = (cv?.experience ?? []).map((e) => ({
    company: e.company ?? "",
    title: e.title ?? "",
    originalTitle: e.originalTitle ?? e.title ?? "",
    originalBullets: Array.isArray(e.originalBullets) ? e.originalBullets : [],
    rewrittenBullets: Array.isArray(e.rewrittenBullets) ? e.rewrittenBullets : [],
  }));
  const answers = (row.customAnswers as { whyCompany?: string; whyRole?: string; recentProject?: string } | null) ?? {};
  const validation = (row.tailoringValidation as { clean?: boolean; fabrications?: string[]; embellished?: boolean } | null) ?? {};

  return (
    <ApplicationReview
      applicationId={row.id}
      job={{ title: row.jobTitle, company: row.company, location: row.jobLocation ?? "" }}
      summary={cv?.summary ?? ""}
      skills={Array.isArray(cv?.skills) ? cv.skills : []}
      experience={experience}
      coverLetter={row.coverLetterText ?? ""}
      answers={{ whyCompany: answers.whyCompany ?? "", whyRole: answers.whyRole ?? "", recentProject: answers.recentProject ?? "" }}
      validation={{ clean: validation.clean !== false, fabrications: validation.fabrications ?? [], embellished: validation.embellished === true }}
      state={row.state}
      submissionNote={row.submissionNote ?? ""}
      submissionViewUrl={row.submissionViewUrl ?? undefined}
      awaitingCode={row.awaitingCode}
      submissionLog={(row.submissionLog as { label: string; at: number; status: "active" | "done" | "error" }[] | null) ?? undefined}
    />
  );
}
