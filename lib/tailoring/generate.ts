import Anthropic from "@anthropic-ai/sdk";
import type { Profile } from "@/lib/profile";
import { stripDashes } from "@/lib/sanitize";
import { logUsage } from "@/lib/anthropic-usage";
import type { JdSignals } from "./extract-jd";

export type TailoredOutput = {
  summary: string;
  skills: string[];
  experience: { company: string; title: string; originalTitle: string; rewrittenBullets: string[] }[];
  coverLetter: string;
  answers: { whyCompany: string; whyRole: string; recentProject: string };
};

export type TailorJob = { title: string; company: string; rawJd: string; signals?: JdSignals | null };
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

// Which of this job's wanted skills the candidate genuinely has. We instruct the
// model to LEAD with these (truthful alignment) rather than scatter generic skills.
function skillOverlap(p: Profile, signals?: JdSignals | null): string[] {
  if (!signals) return [];
  const cand = p.skills.map((s) => s.toLowerCase().trim());
  const wanted = [...new Set([...signals.requiredSkills, ...signals.keywords])];
  return wanted.filter((w) => {
    const lw = w.toLowerCase().trim();
    return cand.some((c) => c === lw || c.includes(lw) || lw.includes(c));
  });
}

// A focused brief of what the role wants, built from the extracted signals so the
// model aligns to the real requirements even when they sit deep in a long post.
function jobBrief(job: TailorJob): string {
  const s = job.signals;
  if (!s) return `Description:\n${job.rawJd.slice(0, 6000)}`;
  const lines: string[] = [];
  if (s.seniority) lines.push(`Seniority: ${s.seniority}`);
  if (s.responsibilities.length) lines.push(`Key responsibilities:\n- ${s.responsibilities.join("\n- ")}`);
  if (s.requiredSkills.length) lines.push(`Required skills/tools: ${s.requiredSkills.join(", ")}`);
  if (s.niceToHave.length) lines.push(`Nice to have: ${s.niceToHave.join(", ")}`);
  if (s.keywords.length) lines.push(`Keywords to mirror where truthful: ${s.keywords.join(", ")}`);
  // Keep a trimmed slice of the raw post for any nuance the signals missed.
  lines.push(`Full post (for context):\n${job.rawJd.slice(0, 3500)}`);
  return lines.join("\n\n");
}

export async function generateTailoring(p: Profile, job: TailorJob, opts: TailorOpts = {}): Promise<TailoredOutput> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

  const avoidNote = opts.avoid?.length
    ? `\n\nA previous draft invented these claims. Do NOT include them or anything like them:\n- ${opts.avoid.join("\n- ")}`
    : "";

  const overlap = skillOverlap(p, job.signals);
  const overlapNote = overlap.length
    ? `\n\nSKILLS THE CANDIDATE ALREADY HAS THAT THIS ROLE WANTS (lead with these, use the job's wording): ${overlap.join(", ")}`
    : "";

  const prompt = `You tailor a candidate's application for a specific job.

CANDIDATE (the ONLY facts you may use):
${profileFacts(p)}

JOB:
Title: ${job.title}
Company: ${job.company}
${jobBrief(job)}${overlapNote}

Produce, as JSON only:
{
  "summary": "<2 to 4 sentence professional summary, first person optional, aligned to this role>",
  "skills": ["<the candidate's skills most relevant to this job, ordered by relevance>"],
  "experience": [{ "company": "<exact company from candidate>", "originalTitle": "<the candidate's exact original title>", "title": "<title to display>", "rewrittenBullets": ["...", "..."] }],
  "coverLetter": "<200-350 words, first person, in the candidate's own voice>",
  "answers": { "whyCompany": "...", "whyRole": "...", "recentProject": "..." }
}

Rules (critical):
- ALIGN to this role: lead the summary and skills with the candidate's genuine strengths that match the role's responsibilities and required skills, and mirror the job's own terminology where it is truthful. Rewrite the bullets that are most relevant to the responsibilities first, framing real work in the language of this role. Do not bury the relevant experience.
- Always set "originalTitle" to the candidate's exact title for that role.
- "experience" MUST include EVERY role the candidate lists in CANDIDATE (same companies and dates), each with rewritten bullets. Never omit a role and never return an empty experience array, even when applying to an internship. If the candidate has projects but few jobs, still include the roles they do have.
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
    // Haiku for resume + cover tailoring: ~4x cheaper than Sonnet and strong enough
    // for bullet rewriting / cover letters. Tailoring is included (not billed), so
    // keeping its marginal cost low is what makes the credit model scalable.
    model: "claude-haiku-4-5-20251001",
    max_tokens: 4096,
    messages: [{ role: "user", content: prompt }],
  });
  logUsage("tailor.generate", msg);
  const textPart = msg.content.find((c) => c.type === "text");
  const raw = textPart && "text" in textPart ? textPart.text : "";
  const json = raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1);
  const parsed = JSON.parse(json) as Partial<TailoredOutput>;

  // Rebuild the candidate's real experience straight from their profile (original
  // bullets), used as a fallback below.
  const realExperience = p.experience.map((e) => ({
    company: e.company,
    title: e.title,
    originalTitle: e.title,
    rewrittenBullets: (e.bullets ?? []).filter(Boolean),
  }));

  const out: TailoredOutput = {
    summary: stripDashes(parsed.summary ?? p.summary ?? ""),
    skills: Array.isArray(parsed.skills) && parsed.skills.length
      ? parsed.skills.map(stripDashes).filter(Boolean)
      : p.skills.slice(0, 20),
    // The model sometimes drops the experience array (or truncates it). Never ship a
    // resume with no experience when the candidate actually has some — fall back to
    // their real roles, and backfill bullets per role from the profile if missing.
    experience: [],
    coverLetter: stripDashes(parsed.coverLetter ?? ""),
    answers: {
      whyCompany: stripDashes(parsed.answers?.whyCompany ?? ""),
      whyRole: stripDashes(parsed.answers?.whyRole ?? ""),
      recentProject: stripDashes(parsed.answers?.recentProject ?? ""),
    },
  };

  const modelExp = Array.isArray(parsed.experience) ? parsed.experience.filter((e) => e && e.company) : [];
  if (modelExp.length === 0 && realExperience.length > 0) {
    console.warn(`[tailor] model returned no experience for "${job.title}"; using the candidate's real roles`);
    out.experience = realExperience.map((e) => ({ ...e, rewrittenBullets: e.rewrittenBullets.map(stripDashes) }));
  } else {
    out.experience = modelExp.map((e) => {
      const bullets = Array.isArray(e.rewrittenBullets) && e.rewrittenBullets.length
        ? e.rewrittenBullets
        : realExperience.find((r) => r.company === e.company)?.rewrittenBullets ?? [];
      return {
        company: e.company,
        title: stripDashes(e.title || e.originalTitle || ""),
        originalTitle: e.originalTitle || e.title || "",
        rewrittenBullets: bullets.map(stripDashes).filter(Boolean),
      };
    });
  }

  return out;
}
