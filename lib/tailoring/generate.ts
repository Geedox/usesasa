import Anthropic from "@anthropic-ai/sdk";
import type { Profile } from "@/lib/profile";
import { stripDashes } from "@/lib/sanitize";

export type TailoredOutput = {
  summary: string;
  skills: string[];
  experience: { company: string; title: string; originalTitle: string; rewrittenBullets: string[] }[];
  coverLetter: string;
  answers: { whyCompany: string; whyRole: string; recentProject: string };
};

export type TailorJob = { title: string; company: string; rawJd: string };
export type TailorOpts = { tone?: string; avoid?: string[]; embellish?: boolean };

function profileFacts(p: Profile) {
  return JSON.stringify({
    name: p.full_name,
    summary: p.summary,
    skills: p.skills,
    experience: p.experience.map((e) => ({ company: e.company, title: e.title, dates: `${e.start} to ${e.end}`, bullets: e.bullets })),
    education: p.education.map((e) => ({ institution: e.institution, degree: e.degree, field: e.field })),
  });
}

export async function generateTailoring(p: Profile, job: TailorJob, opts: TailorOpts = {}): Promise<TailoredOutput> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

  const avoidNote = opts.avoid?.length
    ? `\n\nA previous draft invented these claims. Do NOT include them or anything like them:\n- ${opts.avoid.join("\n- ")}`
    : "";

  const prompt = `You tailor a candidate's application for a specific job.

CANDIDATE (the ONLY facts you may use):
${profileFacts(p)}

JOB:
Title: ${job.title}
Company: ${job.company}
Description:
${job.rawJd.slice(0, 4000)}

Produce, as JSON only:
{
  "summary": "<2 to 4 sentence professional summary, first person optional, aligned to this role>",
  "skills": ["<the candidate's skills most relevant to this job, ordered by relevance>"],
  "experience": [{ "company": "<exact company from candidate>", "originalTitle": "<the candidate's exact original title>", "title": "<title to display>", "rewrittenBullets": ["...", "..."] }],
  "coverLetter": "<200-350 words, first person, in the candidate's own voice>",
  "answers": { "whyCompany": "...", "whyRole": "...", "recentProject": "..." }
}

Rules (critical):
- Always set "originalTitle" to the candidate's exact title for that role.
- "summary": rewrite the candidate's summary to align with this role and its keywords. Keep it true to their actual experience.
- "skills": choose from the candidate's skills the ones most relevant to this job and order them by relevance${opts.embellish ? ", and you may add job-relevant skills the candidate did not list" : "; do NOT add skills the candidate did not list"}.
${
  opts.embellish
    ? `- The candidate has EXPLICITLY allowed you to add job-relevant skills and tools they did not list, to better match this role. Add them intelligently: weave skills/tools the job asks for (for example a protocol or framework) into the candidate's existing real roles where they plausibly fit. Keep it believable and modest, not absurd.
- You MAY align "title" toward the target role when the work supports it (for example "Software Engineer" can become "Mobile Software Engineer" for a mobile role). Keep it plausible; do not invent a seniority or a domain the work does not support. Keep the same companies and dates; do not invent employers or degrees.`
    : `- Use ONLY facts present in CANDIDATE. You may rephrase, reorder, and emphasize to align with the job's keywords.
- NEVER invent or imply a skill, employer, title, tool, metric/number, certification, or date the candidate did not state.
- Set "title" EQUAL to "originalTitle"; do not change job titles.
- Do NOT claim or imply the candidate worked at, studied at, lived in, or had any prior link to any company, place, or team that is not explicitly in CANDIDATE. You may express genuine interest in ${job.company} and this role, but never imply past involvement with them.`
}
- Rewrite bullets only for the candidate's existing roles; keep the same company.
- Write in plain, simple, human English. Short, clear sentences. Sound like a real person writing honestly, not a marketing brochure. No clichés, no buzzword stuffing.
- Do NOT use any dash characters: no hyphen ("-"), no en dash, no em dash. Rephrase instead. Use commas or periods, and write compound words as separate words (for example "full stack", not "full-stack").
- Cover letter: warm, specific, the candidate's own voice, 200-350 words.
- Answers: drawn from the candidate's real experience, concise (2-4 sentences each).
- Tone: ${opts.tone ?? "professional and direct"}.${avoidNote}

Return ONLY the JSON object.`;

  const anthropic = new Anthropic({ apiKey });
  const msg = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 3000,
    messages: [{ role: "user", content: prompt }],
  });
  const textPart = msg.content.find((c) => c.type === "text");
  const raw = textPart && "text" in textPart ? textPart.text : "";
  const json = raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1);
  const out = JSON.parse(json) as TailoredOutput;

  // Deterministic no-dash safety net (the prompt also forbids dashes).
  out.summary = stripDashes(out.summary ?? "");
  out.skills = Array.isArray(out.skills) ? out.skills.map(stripDashes).filter(Boolean) : [];
  out.coverLetter = stripDashes(out.coverLetter);
  out.answers.whyCompany = stripDashes(out.answers.whyCompany);
  out.answers.whyRole = stripDashes(out.answers.whyRole);
  out.answers.recentProject = stripDashes(out.answers.recentProject);
  out.experience = out.experience.map((e) => ({
    ...e,
    rewrittenBullets: e.rewrittenBullets.map(stripDashes),
  }));
  return out;
}
