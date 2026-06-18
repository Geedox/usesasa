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

  // Operational failures below THROW so the queue retries (with backoff).
  const url = cloudinary.url(cvPublicId, {
    resource_type: "raw",
    type: "authenticated",
    sign_url: true,
    secure: true,
  });
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`[parse] could not fetch CV from Cloudinary: ${res.status}`);
  }
  const base64 = Buffer.from(await res.arrayBuffer()).toString("base64");

  const anthropic = new Anthropic({ apiKey });
  const msg = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
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

  const textPart = msg.content.find((c) => c.type === "text");
  const raw = textPart && "text" in textPart ? textPart.text : "";
  const jsonStr = raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1);
  const parsed = JSON.parse(jsonStr);

  await db.update(profiles).set({ parsedData: parsed }).where(eq(profiles.id, profileId));
  console.log("[parse] profile parsed:", profileId);
}
