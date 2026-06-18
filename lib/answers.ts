import Anthropic from "@anthropic-ai/sdk";
import type { Profile } from "@/lib/profile";
import { stripDashes } from "@/lib/sanitize";
import { validateNoFabrication } from "@/lib/tailoring/validate";

export type AnswerQuestion = { id: string; label: string; type: string; options?: string[] };
type Job = { title: string; company: string; rawJd: string };

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
  opts: { embellish?: boolean; avoid?: string[] },
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

  const prompt = `You are filling a job application form for this candidate, applying to "${job.company}" for "${job.title}".

CANDIDATE PROFILE:
${profileFacts(profile)}

JOB DESCRIPTION (for context):
${job.rawJd.slice(0, 2500)}

Answer each form question below:
${qList}

Rules:
- ${honesty}
- For a [select] or [radio], return EXACTLY one of the listed options, copied verbatim.
- For a [checkbox], return "yes" or "no" (yes for standard consent or eligibility the candidate meets).
- For [text]/[textarea], write a concise, specific, first person answer (1-3 sentences, under 80 words).
- Write in plain, simple, human English. Do NOT use any dash characters (no hyphen, en dash, or em dash).
- If you genuinely cannot answer from the profile, return an empty string for that id.${avoidNote}

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
  opts: { embellish?: boolean } = {},
): Promise<Record<string, string>> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || questions.length === 0) return {};
  const anthropic = new Anthropic({ apiKey });

  let answers = await callModel(anthropic, profile, job, questions, { embellish: opts.embellish });

  // The user opted into embellishment, so the guard does not apply.
  if (opts.embellish) return answers;

  const freeTextIds = questions.filter((q) => q.type === "text" || q.type === "textarea").map((q) => q.id);
  const combined = () => freeTextIds.map((id) => answers[id]).filter(Boolean).join("\n");
  if (!combined()) return answers;

  const jobForCheck = { company: job.company, title: job.title };
  let fabrications = await validateNoFabrication(profile, combined(), jobForCheck);
  if (fabrications.length > 0) {
    console.warn(`[answers] fabrications flagged, regenerating: ${fabrications.join("; ")}`);
    answers = await callModel(anthropic, profile, job, questions, { avoid: fabrications });
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
