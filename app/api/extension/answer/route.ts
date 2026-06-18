import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { applications, jobs, companies, profiles, preferences } from "@/lib/db/schema";
import { userFromBearer } from "@/lib/extension-auth";
import { normalizeProfile } from "@/lib/profile";
import { generateAnswers, type AnswerQuestion } from "@/lib/answers";

// The extension calls this when a form has custom questions it cannot map.
// We answer them from the candidate's profile + the job and return id -> answer.
export async function POST(req: Request) {
  const user = await userFromBearer(req);
  if (!user) return NextResponse.json({ error: "Invalid token." }, { status: 401 });

  const { applicationId, questions } = (await req.json().catch(() => ({}))) as {
    applicationId?: string;
    questions?: AnswerQuestion[];
  };
  if (!applicationId || !Array.isArray(questions) || questions.length === 0) {
    return NextResponse.json({ answers: {} });
  }

  const app = await db.query.applications.findFirst({
    where: and(eq(applications.id, applicationId), eq(applications.userId, user.id)),
  });
  if (!app) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const job = await db.query.jobs.findFirst({ where: eq(jobs.id, app.jobId) });
  const profileRow = await db.query.profiles.findFirst({
    where: and(eq(profiles.userId, user.id), eq(profiles.isCurrent, true)),
  });
  if (!job || !profileRow?.parsedData) return NextResponse.json({ answers: {} });

  const company = await db.query.companies.findFirst({ where: eq(companies.id, job.companyId) });
  const prefs = await db.query.preferences.findFirst({ where: eq(preferences.userId, user.id) });
  const embellish =
    (prefs?.onboarding as { applicationSettings?: { allowEmbellishment?: boolean } } | null)?.applicationSettings
      ?.allowEmbellishment === true;

  console.log(`[extension] answering ${questions.length} question(s) for app ${applicationId}`);
  const answers = await generateAnswers(
    normalizeProfile(profileRow.parsedData),
    { title: job.title, company: company?.name ?? "", rawJd: job.rawJd ?? "" },
    questions.slice(0, 20),
    { embellish },
  );

  // Persist alongside the application so a retry reuses them.
  const merged = { ...(app.customAnswers as Record<string, unknown> | null), ...answers };
  await db.update(applications).set({ customAnswers: merged }).where(eq(applications.id, applicationId));

  return NextResponse.json({ answers });
}
