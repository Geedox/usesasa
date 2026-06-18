import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { applications, jobs, companies, profiles, preferences } from "@/lib/db/schema";
import { normalizeProfile } from "@/lib/profile";
import { generateTailoring, type TailoredOutput } from "./generate";
import { validateNoFabrication } from "./validate";
import { notifyReviewReady, notifyNeedsReview } from "@/lib/telegram";

function combined(out: TailoredOutput): string {
  return [
    ...out.experience.flatMap((e) => e.rewrittenBullets),
    out.coverLetter,
    out.answers.whyCompany,
    out.answers.whyRole,
    out.answers.recentProject,
  ].join("\n");
}

export async function tailorApplication(applicationId: string): Promise<void> {
  const app = await db.query.applications.findFirst({ where: eq(applications.id, applicationId) });
  if (!app) throw new Error(`application ${applicationId} not found`);

  const job = await db.query.jobs.findFirst({ where: eq(jobs.id, app.jobId) });
  const profileRow = await db.query.profiles.findFirst({
    where: and(eq(profiles.userId, app.userId), eq(profiles.isCurrent, true)),
  });
  if (!job || !profileRow?.parsedData) {
    // Can't tailor without a job + parsed profile; flag for the user instead of looping.
    await db.update(applications).set({ state: "needs_user" }).where(eq(applications.id, applicationId));
    return;
  }
  const profile = normalizeProfile(profileRow.parsedData);

  const prefs = await db.query.preferences.findFirst({ where: eq(preferences.userId, app.userId) });
  const appSettings = (prefs?.onboarding as {
    applicationSettings?: { resumeOptimization?: string; allowEmbellishment?: boolean };
  } | null)?.applicationSettings;
  const tone =
    appSettings?.resumeOptimization === "aggressive"
      ? "confident and keyword-forward, still strictly truthful"
      : "professional and direct";
  // Only the user can switch this on (onboarding / settings). Default false.
  const embellish = appSettings?.allowEmbellishment === true;

  const company = await db.query.companies.findFirst({ where: eq(companies.id, job.companyId) });
  const jobInput = { title: job.title, company: company?.name ?? "", rawJd: job.rawJd ?? "" };
  const jobForCheck = { company: jobInput.company, title: jobInput.title };

  let out: TailoredOutput;
  let fabrications: string[];
  let clean: boolean;

  if (embellish) {
    // User explicitly allowed adding skills they did not list: generate in
    // embellish mode and skip the fabrication gate (they own this choice).
    out = await generateTailoring(profile, jobInput, { tone, embellish: true });
    fabrications = [];
    clean = true;
  } else {
    // Default: generate, validate, regenerate once if fabrications are found.
    out = await generateTailoring(profile, jobInput, { tone });
    fabrications = await validateNoFabrication(profile, combined(out), jobForCheck);
    if (fabrications.length > 0) {
      out = await generateTailoring(profile, jobInput, { tone, avoid: fabrications });
      fabrications = await validateNoFabrication(profile, combined(out), jobForCheck);
    }
    clean = fabrications.length === 0;
  }

  // Pair rewritten bullets with the originals (for the diff view).
  const tailoredCv = {
    experience: out.experience.map((e) => {
      const original = profile.experience.find(
        (x) => x.company.toLowerCase() === e.company.toLowerCase() && x.title.toLowerCase() === e.title.toLowerCase(),
      );
      return {
        company: e.company,
        title: e.title,
        originalBullets: original?.bullets ?? [],
        rewrittenBullets: e.rewrittenBullets,
      };
    }),
  };

  await db
    .update(applications)
    .set({
      tailoredCv,
      coverLetterText: out.coverLetter,
      customAnswers: out.answers,
      tailoringValidation: { fabrications, clean, embellished: embellish },
      state: clean ? "awaiting_review" : "needs_user",
    })
    .where(eq(applications.id, applicationId));

  // Nudge the user on Telegram: ready to approve, or needs a quick review of
  // the flagged claims. No-op if unlinked.
  if (clean) await notifyReviewReady(applicationId);
  else await notifyNeedsReview(applicationId);
}
