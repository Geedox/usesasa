import Anthropic from "@anthropic-ai/sdk";

// What a job post actually wants, pulled out of the prose so tailoring aligns to
// the real requirements, not the marketing intro. Many posts bury the required
// skills near the end (past where a naive slice would cut), so we read the whole
// post once and return a compact structure the tailoring prompt can lean on.
export type JdSignals = {
  responsibilities: string[];
  requiredSkills: string[];
  niceToHave: string[];
  keywords: string[];
  seniority: string;
};

export async function extractJdSignals(title: string, company: string, rawJd: string): Promise<JdSignals | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || rawJd.trim().length < 80) return null;

  const anthropic = new Anthropic({ apiKey });
  try {
    const msg = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1200,
      messages: [{
        role: "user",
        content: `Pull the key hiring signals out of this job post. Return ONLY JSON:
{"responsibilities":["..."],"requiredSkills":["..."],"niceToHave":["..."],"keywords":["..."],"seniority":"<junior|mid|senior|lead|manager or empty>"}

Rules:
- requiredSkills + keywords: concrete skills, tools, technologies, frameworks, methods, or domains the role needs (for example React, Node.js, AWS, CI/CD, REST APIs, curriculum design). Short noun phrases, deduplicated.
- responsibilities: the main duties, at most 8, each one short line.
- niceToHave: preferred but optional items.
- Be faithful to the post. Do not invent anything that is not there.

ROLE: ${title}${company ? ` at ${company}` : ""}
POST:
${rawJd.slice(0, 8000)}`,
      }],
    });
    const part = msg.content.find((c) => c.type === "text");
    const raw = part && "text" in part ? part.text : "";
    const parsed = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1)) as Partial<JdSignals>;
    const arr = (v: unknown) => (Array.isArray(v) ? v.map(String).map((s) => s.trim()).filter(Boolean) : []);
    return {
      responsibilities: arr(parsed.responsibilities).slice(0, 8),
      requiredSkills: arr(parsed.requiredSkills).slice(0, 30),
      niceToHave: arr(parsed.niceToHave).slice(0, 15),
      keywords: arr(parsed.keywords).slice(0, 30),
      seniority: typeof parsed.seniority === "string" ? parsed.seniority.trim() : "",
    };
  } catch {
    return null;
  }
}
