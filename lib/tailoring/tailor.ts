import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { applications, jobs, companies, profiles, preferences } from "@/lib/db/schema";
import { normalizeProfile } from "@/lib/profile";
import { getBalance, chargeForTailoring } from "@/lib/credits";
import { isSubscriber, getEntitlement } from "@/lib/subscription";
import { generateTailoring, type TailoredOutput } from "./generate";
import { extractJdSignals } from "./extract-jd";
import { validateNoFabrication } from "./validate";
import { notifyReviewReady, notifyNeedsReview, notifySubmissionBlocked } from "@/lib/telegram";

function combined(out: TailoredOutput): string {
  return [
    out.summary,
    out.skills.join(", "),
    ...out.experience.flatMap((e) => e.rewrittenBullets),
    out.coverLetter,
    out.answers.whyCompany,
    out.answers.whyRole,
    out.answers.recentProject,
  ].join("\n");
}

export async function tailorApplication(
  applicationId: string,
  opts: { embellishOverride?: boolean } = {},
): Promise<void> {
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

  // Gate before spending the LLM. Subscribers (international) are metered by their
  // monthly application allowance; everyone else (Nigeria / free) pays 1 credit.
  const subscriber = await isSubscriber(app.userId);
  if (subscriber) {
    const ent = await getEntitlement(app.userId);
    if (ent.remaining <= 0) {
      const note = "You have reached your plan's application limit for this cycle. Upgrade or wait for the reset.";
      await db.update(applications).set({ state: "needs_user", submissionNote: note }).where(eq(applications.id, applicationId));
      await notifySubmissionBlocked(applicationId, "needs_user", note);
      return;
    }
  } else if ((await getBalance(app.userId)) < 1) {
    const note = "You are out of credits. Top up to tailor and submit this application.";
    await db.update(applications).set({ state: "needs_user", submissionNote: note }).where(eq(applications.id, applicationId));
    await notifySubmissionBlocked(applicationId, "needs_user", note);
    return;
  }

  const prefs = await db.query.preferences.findFirst({ where: eq(preferences.userId, app.userId) });
  const appSettings = (prefs?.onboarding as {
    applicationSettings?: { resumeOptimization?: string; allowEmbellishment?: boolean };
  } | null)?.applicationSettings;
  const tone =
    appSettings?.resumeOptimization === "aggressive"
      ? "confident and keyword-forward, still strictly truthful"
      : "professional and direct";
  // A per-tailor override (from the extension widget toggle) wins; otherwise fall
  // back to the user's saved setting (onboarding / settings). Default false.
  const embellish = opts.embellishOverride ?? (appSettings?.allowEmbellishment === true);

  const company = await db.query.companies.findFirst({ where: eq(companies.id, job.companyId) });
  // Pull the role's real requirements out of the post so tailoring aligns to them,
  // not just the marketing intro (which is often all that fits in a naive slice).
  const signals = await extractJdSignals(job.title, company?.name ?? "", job.rawJd ?? "");
  const jobInput = { title: job.title, company: company?.name ?? "", rawJd: job.rawJd ?? "", signals };
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

  // Pair rewritten bullets with the originals (for the diff view). Pair on the
  // original title so an embellish-aligned display title still matches its role.
  const tailoredCv = {
    summary: out.summary,
    skills: out.skills,
    experience: out.experience.map((e) => {
      const origTitle = e.originalTitle ?? e.title;
      const original =
        profile.experience.find(
          (x) => x.company.toLowerCase() === e.company.toLowerCase() && x.title.toLowerCase() === origTitle.toLowerCase(),
        ) ?? profile.experience.find((x) => x.company.toLowerCase() === e.company.toLowerCase());
      return {
        company: e.company,
        title: e.title,
        originalTitle: origTitle,
        originalBullets: original?.bullets ?? [],
        rewrittenBullets: e.rewrittenBullets,
      };
    }),
  };

  // Charge the 1 tailoring credit now that the work is done (credits users only;
  // subscribers are metered by allowance at submission instead).
  if (!subscriber) await chargeForTailoring(app.userId, applicationId);

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
