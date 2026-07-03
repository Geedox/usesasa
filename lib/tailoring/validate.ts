import Anthropic from "@anthropic-ai/sdk";
import type { Profile } from "@/lib/profile";
import { logUsage } from "@/lib/anthropic-usage";

// Constitution II gate: detect any claim in generated content not grounded in the
// canonical profile. Returns the list of fabrications (empty = clean).
// `job` lets the checker know the target employer/role, so legitimate references
// to the company being applied to are not mistaken for fabrications.
export async function validateNoFabrication(
  p: Profile,
  content: string,
  job?: { company: string; title: string },
): Promise<string[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

  const facts = JSON.stringify({
    summary: p.summary,
    skills: p.skills,
    experience: p.experience.map((e) => ({ company: e.company, title: e.title, dates: `${e.start}–${e.end}`, bullets: e.bullets })),
    education: p.education.map((e) => ({ institution: e.institution, degree: e.degree, field: e.field })),
    certifications: p.certifications,
  });

  const applyingTo = job
    ? `The candidate is APPLYING to "${job.company}" for the role "${job.title}". Mentioning ${job.company}, this role, the job description, or expressing interest in working there is expected and is NOT a fabrication. Only flag claims that the candidate already HAS experience, employment, education, skills, tools, certifications, metrics, or dates that are not in their true facts.\n\n`
    : "";

  const prompt = `You are a strict fact checker for a job application.

CANDIDATE'S TRUE FACTS (the only allowed source):
${facts}

${applyingTo}GENERATED APPLICATION CONTENT to check:
${content.slice(0, 6000)}

List every specific claim in the generated content that is NOT supported by the candidate's true facts:
an invented employer the candidate claims to have worked at, a job title, skill or tool they claim to have, a metric or number, a certification, a degree, or a date.
General phrasing, emphasis, and genuine interest in the target company are fine. Only flag concrete unsupported claims of the candidate's own experience or credentials.

Return ONLY JSON: {"fabrications": ["<short description of each unsupported claim>"]}.
If everything is supported, return {"fabrications": []}.`;

  const anthropic = new Anthropic({ apiKey });
  const msg = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 600,
    messages: [{ role: "user", content: prompt }],
  });
  logUsage("tailor.validate", msg);
  const textPart = msg.content.find((c) => c.type === "text");
  const raw = textPart && "text" in textPart ? textPart.text : "";
  const json = raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1);
  try {
    const parsed = JSON.parse(json) as { fabrications?: string[] };
    return Array.isArray(parsed.fabrications) ? parsed.fabrications.filter(Boolean) : [];
  } catch {
    return []; // on parse failure, don't hard-block; the prompt-side grounding still applies
  }
}
