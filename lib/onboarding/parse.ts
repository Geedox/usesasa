import Anthropic from "@anthropic-ai/sdk";
import { eq } from "drizzle-orm";
import { cloudinary } from "@/lib/cloudinary";
import { db } from "@/lib/db";
import { profiles } from "@/lib/db/schema";

// Extracts the structured Profile (FRD §5.1.3) from an uploaded CV using Claude.
// Constitution II: extract only what's in the document; never invent facts.
const PROMPT = `You are extracting a candidate profile from their CV (attached PDF).
Return ONLY a JSON object, no prose, matching this shape:
{
  "full_name": string,
  "email": string,
  "phone": string,
  "location": { "city": string, "country": string },
  "links": { "linkedin"?: string, "github"?: string, "portfolio"?: string },
  "summary": string,
  "experience": [{ "company": string, "title": string, "start": string, "end": string, "location": string, "bullets": string[] }],
  "education": [{ "institution": string, "degree": string, "field": string, "start": string, "end": string, "location": string }],
  "skills": string[],
  "certifications": string[],
  "languages": [{ "language": string, "proficiency": string }]
}
Rules: Use ONLY information present in the CV. If a field is unknown, use an empty string or empty array. Never invent employers, dates, skills, or credentials.`;

export async function parseCvForProfile(profileId: string, cvPublicId: string): Promise<void> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn("[parse] ANTHROPIC_API_KEY not set — skipping CV parse (profile stays unparsed).");
    return;
  }

  // Operational failures below THROW so the queue retries (with backoff). Each step
  // is labelled so a failure shows up in the worker log instead of a silent stall.
  let step = "cloudinary_url";
  try {
    const url = cloudinary.url(cvPublicId, {
      resource_type: "raw",
      type: "authenticated",
      sign_url: true,
      secure: true,
    });

    // Fetch the CV, but never hang: fail after 30s so the queue can retry.
    step = "cloudinary_fetch";
    const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    if (!res.ok) {
      // A 401/404 here usually means the worker's CLOUDINARY_API_SECRET does not
      // match the web service that uploaded the file (mismatched environment).
      throw new Error(
        `Cloudinary returned ${res.status} for ${cvPublicId}. Check that this worker shares the same CLOUDINARY_* credentials as the web app that uploaded it.`,
      );
    }
    const base64 = Buffer.from(await res.arrayBuffer()).toString("base64");

    // 3-minute cap on the model call, with a couple of automatic retries, so a slow
    // or stuck request fails loudly rather than hanging the whole onboarding.
    step = "anthropic_parse";
    const anthropic = new Anthropic({ apiKey, timeout: 180_000, maxRetries: 2 });
    const msg = await anthropic.messages.create({
      // Haiku is plenty for structured extraction from a CV and costs a fraction of
      // Sonnet. Bump to a larger model only if extraction quality drops.
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: [
            { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } },
            { type: "text", text: PROMPT },
          ],
        },
      ],
    });

    step = "json_parse";
    const textPart = msg.content.find((c) => c.type === "text");
    const raw = textPart && "text" in textPart ? textPart.text : "";
    const jsonStr = raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1);
    if (!jsonStr) throw new Error("model returned no JSON object");
    const parsed = JSON.parse(jsonStr);

    step = "db_write";
    await db.update(profiles).set({ parsedData: parsed }).where(eq(profiles.id, profileId));
    console.log("[parse] profile parsed:", profileId);
  } catch (err) {
    const reason = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    console.error(`[parse] FAILED profile=${profileId} step=${step}: ${reason}`);
    throw err; // let pg-boss retry with backoff
  }
}
