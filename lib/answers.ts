import Anthropic from "@anthropic-ai/sdk";
import type { Profile } from "@/lib/profile";
import { stripDashes } from "@/lib/sanitize";
import { validateNoFabrication } from "@/lib/tailoring/validate";

export type AnswerQuestion = { id: string; label: string; type: string; options?: string[] };
type Job = { title: string; company: string; rawJd: string };

// Details the user gave at onboarding (and from the profile/account) used to
// answer logistics questions like phone, city, country, and work authorization.
export type Applicant = {
  fullName?: string;
  email?: string;
  phone?: string;
  city?: string;
  country?: string;
  state?: string;
  links?: Record<string, string>;
  authorizedCountries?: string[];
  needsSponsorship?: boolean;
  sponsorshipCountries?: string[];
  salaryExpectation?: string;
  salaryPeriod?: string;
  noticePeriod?: string;
  yearsExperience?: string;
};

function profileFacts(profile: Profile): string {
  return JSON.stringify({
    name: profile.full_name,
    summary: profile.summary,
    skills: profile.skills,
    experience: profile.experience.map((e) => ({ company: e.company, title: e.title, bullets: e.bullets })),
    education: profile.education.map((e) => ({ institution: e.institution, degree: e.degree, field: e.field })),
    location: profile.location,
    links: profile.links,
  });
}

// One model pass: answer all questions. `avoid` lists claims a prior pass invented.
async function callModel(
  anthropic: Anthropic,
  profile: Profile,
  job: Job,
  questions: AnswerQuestion[],
  opts: { embellish?: boolean; avoid?: string[]; applicant?: Applicant },
): Promise<Record<string, string>> {
  const qList = questions
    .map((q) => {
      const o = q.options?.length ? ` (choose exactly one: ${q.options.join(" | ")})` : "";
      return `- id "${q.id}" [${q.type}${o}]: ${q.label}`;
    })
    .join("\n");

  const honesty = opts.embellish
    ? "The candidate allowed adding job-relevant skills they did not list; you may do so, plausibly and modestly."
    : "Use ONLY facts in the candidate profile. Never invent employers, titles, degrees, certifications, skills, metrics, or dates.";
  const avoidNote = opts.avoid?.length
    ? `\n\nA previous draft invented these claims. Do NOT include them or anything like them:\n- ${opts.avoid.join("\n- ")}`
    : "";
  const applicantBlock = opts.applicant
    ? `\n\nAPPLICANT DETAILS (the candidate provided these; use them for logistics questions like phone, city, country, links, and work authorization):\n${JSON.stringify(opts.applicant)}`
    : "";

  const prompt = `You are filling a job application form for this candidate, applying to "${job.company}" for "${job.title}".

CANDIDATE PROFILE:
${profileFacts(profile)}${applicantBlock}

JOB DESCRIPTION (for context):
${job.rawJd.slice(0, 2500)}

Answer each form question below:
${qList}

Rules:
- ${honesty}
- Use APPLICANT DETAILS for logistics: salary/compensation expectation (salaryExpectation + salaryPeriod, e.g. "90,000 per year"; if asked for a number only, give the number; if blank, answer "Negotiable" or "Open to discussion"), notice period / availability / earliest start date (noticePeriod, e.g. "2 weeks"; "Immediately" means available now), and total years of experience (yearsExperience).
- Use APPLICANT DETAILS to answer phone, location/city, country, and work eligibility questions. For "are you authorized to work in <country>", answer truthfully from authorizedCountries and needsSponsorship (if the role's country is not one they are authorized in and they need sponsorship, the honest answer is "No"). For "source of right to work", if they need sponsorship and have none, choose the option that means they require sponsorship, or leave it empty if no such option fits.
- For voluntary or demographic self-identification questions (gender, race, ethnicity, veteran status, disability) where the candidate gave no data, do NOT leave it empty. Answer with the neutral decline option these fields always offer, such as "Decline to self identify", "Prefer not to say", "I do not wish to answer", or "I don't wish to answer". Match the wording of a listed option when options are given.
- For a [select] or [radio], return EXACTLY one of the listed options, copied verbatim. These are all REQUIRED, so NEVER leave a select or radio empty: if no option fits the candidate's situation (e.g. a US-state list for a candidate based abroad), pick the least-committal listed option that still lets the form proceed, in this order of preference: an "Other"/"Not applicable"/"N/A"/"Outside the US"/"Remote"/"Prefer not to say"/"Decline" style option if present, otherwise the option closest to their real situation, otherwise the first non-placeholder option.
- For a [checkbox], return "yes" or "no" (yes for standard consent or eligibility the candidate meets).
- For [text]/[textarea], write a concise, specific, first person answer (1-3 sentences, under 80 words).
- LANGUAGE: write each answer in the SAME language as that question and its options. If the question or options are in Japanese, Chinese, French, German, etc., answer in that language (the verbatim option you copy is already in that language). Only default to plain, simple English when the question itself is in English.
- Do NOT use any dash characters (no hyphen, en dash, or em dash).
- Only for a [text]/[textarea] may you return an empty string if you genuinely cannot answer from the profile. A [select], [radio] or [checkbox] must always get a value.${avoidNote}

Return ONLY JSON: {"answers":[{"id":"<id>","answer":"<answer>"}]}.`;

  const msg = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1500,
    messages: [{ role: "user", content: prompt }],
  });
  const textPart = msg.content.find((c) => c.type === "text");
  const raw = textPart && "text" in textPart ? textPart.text : "";
  const json = raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1);

  const out: Record<string, string> = {};
  try {
    const parsed = JSON.parse(json) as { answers?: { id: string; answer: string }[] };
    for (const a of parsed.answers ?? []) {
      if (!a?.id) continue;
      const q = questions.find((x) => x.id === a.id);
      out[a.id] = q && (q.type === "select" || q.type === "radio" || q.type === "checkbox")
        ? String(a.answer ?? "")
        : stripDashes(String(a.answer ?? ""));
    }
  } catch {
    /* return whatever we parsed */
  }
  return out;
}

// Answer custom application questions from the candidate's profile and the job.
// Honest by default, with a no-fabrication guard on free-text answers: if the
// fact checker flags any, regenerate once; if still flagged, leave those answers
// blank (so a fabrication is never submitted) rather than guess.
export async function generateAnswers(
  profile: Profile,
  job: Job,
  questions: AnswerQuestion[],
  opts: { embellish?: boolean; applicant?: Applicant } = {},
): Promise<Record<string, string>> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || questions.length === 0) return {};
  const anthropic = new Anthropic({ apiKey });

  let answers = await callModel(anthropic, profile, job, questions, { embellish: opts.embellish, applicant: opts.applicant });

  // The user opted into embellishment, so the guard does not apply.
  if (opts.embellish) return answers;

  const freeTextIds = questions.filter((q) => q.type === "text" || q.type === "textarea").map((q) => q.id);
  const combined = () => freeTextIds.map((id) => answers[id]).filter(Boolean).join("\n");
  if (!combined()) return answers;

  const jobForCheck = { company: job.company, title: job.title };
  let fabrications = await validateNoFabrication(profile, combined(), jobForCheck);
  if (fabrications.length > 0) {
    console.warn(`[answers] fabrications flagged, regenerating: ${fabrications.join("; ")}`);
    answers = await callModel(anthropic, profile, job, questions, { avoid: fabrications, applicant: opts.applicant });
    fabrications = await validateNoFabrication(profile, combined(), jobForCheck);
    if (fabrications.length > 0) {
      // Could not answer honestly. Blank the free-text answers so nothing
      // unsupported is submitted; the form will flag those as needs_user.
      console.warn("[answers] still flagged after retry, leaving free-text answers blank");
      for (const id of freeTextIds) answers[id] = "";
    }
  }
  return answers;
}
