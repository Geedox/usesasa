import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { profiles, preferences } from "@/lib/db/schema";
import { userFromBearer } from "@/lib/extension-auth";
import { normalizeProfile } from "@/lib/profile";
import { generateAnswers, type AnswerQuestion } from "@/lib/answers";
import { canUseSasa } from "@/lib/can-use";

// Universal widget: suggest answers to the questions scanned from any job form.
// Like /api/extension/answer but with no application — the job context comes from
// the scraped page. Returns answers keyed by the question id (we use the label).
export async function POST(req: Request) {
  const user = await userFromBearer(req);
  if (!user) return NextResponse.json({ error: "Invalid token." }, { status: 401 });

  const can = await canUseSasa(user.id);
  if (!can.ok) return NextResponse.json({ error: can.error }, { status: 402 });

  const { questions, title, company, jd } = (await req.json().catch(() => ({}))) as {
    questions?: AnswerQuestion[];
    title?: string;
    company?: string;
    jd?: string;
  };
  if (!Array.isArray(questions) || questions.length === 0) return NextResponse.json({ answers: {} });

  const profileRow = await db.query.profiles.findFirst({ where: and(eq(profiles.userId, user.id), eq(profiles.isCurrent, true)) });
  if (!profileRow?.parsedData) return NextResponse.json({ answers: {} });
  const profile = normalizeProfile(profileRow.parsedData);

  const prefs = await db.query.preferences.findFirst({ where: eq(preferences.userId, user.id) });
  const onboarding = (prefs?.onboarding as {
    applicationSettings?: { allowEmbellishment?: boolean };
    contact?: { phone?: string; linkedin?: string; github?: string; portfolio?: string };
    location?: { city?: string; country?: string; state?: string };
    workEligibility?: { authorizedCountries?: string[]; needsSponsorship?: boolean; sponsorshipCountries?: string[] };
    comp?: { salaryExpectation?: string; salaryPeriod?: string; noticePeriod?: string; yearsExperience?: string };
  } | null) ?? {};

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
    salaryPeriod: onboarding.comp?.salaryPeriod,
    noticePeriod: onboarding.comp?.noticePeriod,
    yearsExperience: onboarding.comp?.yearsExperience,
  };

  const answers = await generateAnswers(
    profile,
    { title: (title || "Role").slice(0, 200), company: (company || "").slice(0, 120), rawJd: (jd || "").slice(0, 8000) },
    questions.slice(0, 25),
    { embellish: onboarding.applicationSettings?.allowEmbellishment === true, applicant },
  );

  return NextResponse.json({ answers });
}
