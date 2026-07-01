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
  const onboarding = (prefs?.onboarding as {
    applicationSettings?: { allowEmbellishment?: boolean };
    contact?: { phone?: string; linkedin?: string; github?: string; portfolio?: string };
    location?: { city?: string; country?: string; state?: string };
    workEligibility?: { authorizedCountries?: string[]; needsSponsorship?: boolean; sponsorshipCountries?: string[] };
    comp?: { salaryExpectation?: string; salaryCurrency?: string; salaryPeriod?: string; noticePeriod?: string; yearsExperience?: string };
  } | null) ?? {};
  const embellish = onboarding.applicationSettings?.allowEmbellishment === true;

  const profile = normalizeProfile(profileRow.parsedData);
  // Combine what the user gave at onboarding with the parsed profile/account so
  // the agent can answer logistics questions (phone, city, work authorization).
  const applicant = {
    fullName: profile.full_name || user.name || undefined,
    email: profile.email || user.email,
    phone: profile.phone || onboarding.contact?.phone,
    city: onboarding.location?.city || profile.location?.city,
    country: onboarding.location?.country || profile.location?.country,
    state: onboarding.location?.state,
    links: { ...profile.links, ...onboarding.contact },
    authorizedCountries: onboarding.workEligibility?.authorizedCountries,
    needsSponsorship: onboarding.workEligibility?.needsSponsorship,
    sponsorshipCountries: onboarding.workEligibility?.sponsorshipCountries,
    salaryExpectation: onboarding.comp?.salaryExpectation,
    salaryCurrency: onboarding.comp?.salaryCurrency,
    salaryPeriod: onboarding.comp?.salaryPeriod,
    noticePeriod: onboarding.comp?.noticePeriod,
    yearsExperience: onboarding.comp?.yearsExperience,
  };

  console.log(`[extension] answering ${questions.length} question(s) for app ${applicationId}`);
  console.log(
    "[extension] questions + options:",
    questions.map((q) => `${q.label} [${q.type}] options=[${(q.options ?? []).join(" | ") || "none"}]`),
  );
  const answers = await generateAnswers(
    profile,
    { title: job.title, company: company?.name ?? "", rawJd: job.rawJd ?? "" },
    questions.slice(0, 20),
    { embellish, applicant },
  );

  console.log(
    `[extension] generated answers:`,
    questions.map((q) => `${q.label} [${q.type}] => ${answers[q.id] || "(empty)"}`),
  );

  // Persist alongside the application so a retry reuses them.
  const merged = { ...(app.customAnswers as Record<string, unknown> | null), ...answers };
  await db.update(applications).set({ customAnswers: merged }).where(eq(applications.id, applicationId));

  return NextResponse.json({ answers });
}
