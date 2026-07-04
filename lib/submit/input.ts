import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { applications, jobs, companies, profiles, preferences, users } from "@/lib/db/schema";
import { normalizeProfile } from "@/lib/profile";
import { cloudinary } from "@/lib/cloudinary";
import { generateAnswers, type AnswerQuestion } from "@/lib/answers";

export type Ats = "greenhouse" | "lever" | "ashby" | "smartrecruiters" | "workday" | "workable" | "teamtailor" | "recruitee" | "bamboohr" | "breezy" | "personio" | "gem" | "custom";

// The ATSes the cloud filler has field maps for. Anything else (aggregator sources
// like remoteok / myjobmag / remotive, or an unknown board) falls back to "custom":
// we still open the apply URL in the cloud browser and try a generic fill, so the
// user can always watch and take over instead of getting "not supported".
const SUBMITTABLE_ATS = new Set<string>([
  "greenhouse", "lever", "ashby", "smartrecruiters", "workday", "workable",
  "teamtailor", "recruitee", "bamboohr", "breezy", "personio", "gem", "custom",
]);
function toSubmitAts(source: string): Ats {
  return (SUBMITTABLE_ATS.has(source) ? source : "custom") as Ats;
}

// Direct ATS boards we can reliably auto-submit to in the cloud browser. Aggregators
// (remoteok, himalayas, myjobmag, remotive, weworkremotely, …) and unknown/custom
// boards usually redirect to the employer's own site and/or sit behind a bot wall, so
// those are better applied to in the user's own browser.
const DIRECT_ATS = new Set<string>([
  "greenhouse", "lever", "ashby", "smartrecruiters", "workday", "workable",
  "teamtailor", "recruitee", "bamboohr", "breezy", "personio", "gem",
]);
export function prefersManualApply(source: string): boolean {
  return !DIRECT_ATS.has(source);
}

// Build the URL of the application *form* (not just the posting page). Lever and
// Ashby render the posting at the stored url; the form lives at a sub-path.
export function applyUrlFor(r: {
  jobUrl: string | null;
  jobSource: string;
  jobExternalId: string;
  companySlug: string | null;
}): string {
  const base = (r.jobUrl ?? "").replace(/\/$/, "");
  switch (r.jobSource) {
    case "greenhouse":
      return base || `https://job-boards.greenhouse.io/${r.companySlug}/jobs/${r.jobExternalId}`;
    case "lever": {
      const url = base || `https://jobs.lever.co/${r.companySlug}/${r.jobExternalId}`;
      return /\/apply$/.test(url) ? url : `${url}/apply`;
    }
    case "ashby": {
      const url = base || `https://jobs.ashbyhq.com/${r.companySlug}/${r.jobExternalId}`;
      return /\/application$/.test(url) ? url : `${url}/application`;
    }
    case "workable": {
      const url = base || `https://apply.workable.com/j/${r.jobExternalId}`;
      return /\/apply\/?$/.test(url) ? url : `${url}/apply`;
    }
    case "smartrecruiters":
      // The posting page hosts the application form (after "I'm interested").
      return base || `https://jobs.smartrecruiters.com/${r.companySlug}/${r.jobExternalId}`;
    case "teamtailor":
      // The job page hosts the application form (an "Apply" button reveals it).
      return base;
    case "recruitee":
      // careers_apply_url already points at the application form (".../c/new").
      return /\/c\/new\/?$/.test(base) ? base : `${base}/c/new`;
    case "bamboohr":
      // The careers/<id> page hosts the application form.
      return base;
    case "breezy":
    case "personio":
    case "gem":
      // The posting page hosts (or links to) the application form.
      return base;
    case "custom":
      // The extracted job/apply link; the Steel filler opens it and fills.
      return base;
    default:
      return base;
  }
}

export type SubmitContext = {
  ats: Ats;
  applyUrl: string;
  company: string;
  title: string;
  fields: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    linkedin: string;
    github: string;
    portfolio: string;
  };
  coverLetter: string;
  answers: Record<string, string>;
  resumeBase64: string | null;
  resumeName: string;
  requestAnswers: (questions: AnswerQuestion[]) => Promise<Record<string, string>>;
};

async function fetchResumeBase64(cvStoragePath: string | null | undefined): Promise<string | null> {
  if (!cvStoragePath) return null;
  const url = cloudinary.url(cvStoragePath, {
    resource_type: "raw",
    type: "authenticated",
    sign_url: true,
    secure: true,
  });
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return buf.toString("base64");
  } catch {
    return null;
  }
}

// Assemble everything the cloud submitter (or the extension) needs to fill and
// submit one application — fields, résumé bytes, persisted answers, and a closure
// that answers any custom questions the form surfaces (same logic as the
// extension's /answer route, so behaviour is identical).
export async function buildSubmitContext(applicationId: string): Promise<SubmitContext | null> {
  const app = await db.query.applications.findFirst({ where: eq(applications.id, applicationId) });
  if (!app) return null;

  const user = await db.query.users.findFirst({ where: eq(users.id, app.userId) });
  const job = await db.query.jobs.findFirst({ where: eq(jobs.id, app.jobId) });
  if (!user || !job) return null;
  const company = await db.query.companies.findFirst({ where: eq(companies.id, job.companyId) });
  const profileRow = await db.query.profiles.findFirst({
    where: and(eq(profiles.userId, user.id), eq(profiles.isCurrent, true)),
  });
  if (!profileRow?.parsedData) return null;
  const profile = normalizeProfile(profileRow.parsedData);

  const prefsRow = await db.query.preferences.findFirst({ where: eq(preferences.userId, user.id) });
  const onboarding = (prefsRow?.onboarding as {
    applicationSettings?: { allowEmbellishment?: boolean };
    contact?: { phone?: string; linkedin?: string; github?: string; portfolio?: string };
    location?: { city?: string; country?: string; state?: string };
    workEligibility?: { authorizedCountries?: string[]; needsSponsorship?: boolean; sponsorshipCountries?: string[] };
    comp?: { salaryExpectation?: string; salaryPeriod?: string; noticePeriod?: string; yearsExperience?: string };
  } | null) ?? {};
  const contact = onboarding.contact ?? {};
  const embellish = onboarding.applicationSettings?.allowEmbellishment === true;

  const [firstName, ...rest] = (profile.full_name ?? user.name ?? "").trim().split(/\s+/);
  const fields = {
    firstName: firstName ?? "",
    lastName: rest.join(" "),
    email: profile.email || user.email,
    phone: profile.phone || contact.phone || "",
    linkedin: profile.links.linkedin || contact.linkedin || "",
    github: profile.links.github || contact.github || "",
    portfolio: profile.links.portfolio || contact.portfolio || "",
  };

  const applicant = {
    fullName: profile.full_name || user.name || undefined,
    email: profile.email || user.email,
    phone: profile.phone || contact.phone,
    city: onboarding.location?.city || profile.location?.city,
    country: onboarding.location?.country || profile.location?.country,
    state: onboarding.location?.state,
    links: { ...profile.links, ...contact },
    authorizedCountries: onboarding.workEligibility?.authorizedCountries,
    needsSponsorship: onboarding.workEligibility?.needsSponsorship,
    sponsorshipCountries: onboarding.workEligibility?.sponsorshipCountries,
    salaryExpectation: onboarding.comp?.salaryExpectation,
    salaryPeriod: onboarding.comp?.salaryPeriod,
    noticePeriod: onboarding.comp?.noticePeriod,
    yearsExperience: onboarding.comp?.yearsExperience,
  };

  const resumeBase64 = await fetchResumeBase64(profileRow.cvStoragePath);

  const requestAnswers = async (questions: AnswerQuestion[]): Promise<Record<string, string>> => {
    if (!questions.length) return {};
    console.log(`[cloud] answering ${questions.length} question(s) for app ${applicationId}`);
    const answers = await generateAnswers(
      profile,
      { title: job.title, company: company?.name ?? "", rawJd: job.rawJd ?? "" },
      questions.slice(0, 20),
      { embellish, applicant },
    );
    // Persist so a retry reuses them.
    const fresh = await db.query.applications.findFirst({ where: eq(applications.id, applicationId) });
    const merged = { ...(fresh?.customAnswers as Record<string, unknown> | null), ...answers };
    await db.update(applications).set({ customAnswers: merged }).where(eq(applications.id, applicationId));
    return answers;
  };

  return {
    ats: toSubmitAts(job.source),
    applyUrl: applyUrlFor({ jobUrl: job.url, jobSource: job.source, jobExternalId: job.externalId, companySlug: company?.atsSlug ?? null }),
    company: company?.name ?? "",
    title: job.title,
    fields,
    coverLetter: app.coverLetterText ?? "",
    answers: (app.customAnswers as Record<string, string>) ?? {},
    resumeBase64,
    resumeName: `${(profile.full_name ?? "resume").replace(/\s+/g, "_")}_Resume.pdf`,
    requestAnswers,
  };
}
