import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { profiles, preferences } from "@/lib/db/schema";
import { userFromBearer } from "@/lib/extension-auth";
import { normalizeProfile } from "@/lib/profile";
import { stripDashes } from "@/lib/sanitize";
import { logUsage } from "@/lib/anthropic-usage";
import { canUseSasa } from "@/lib/can-use";

// Draft a short job-application email or DM from the candidate's profile + the
// scraped job, for pages where you apply by email / DM (no form). The widget shows
// it for the user to copy and send (we don't auto-send).
export async function POST(req: Request) {
  const user = await userFromBearer(req);
  if (!user) return NextResponse.json({ error: "Invalid token." }, { status: 401 });

  const can = await canUseSasa(user.id);
  if (!can.ok) return NextResponse.json({ error: can.error }, { status: 402 });

  const { title, company, jd, contactKind, contactValue } = (await req.json().catch(() => ({}))) as {
    title?: string; company?: string; jd?: string; contactKind?: "email" | "dm"; contactValue?: string;
  };
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Not configured." }, { status: 503 });

  const profileRow = await db.query.profiles.findFirst({ where: and(eq(profiles.userId, user.id), eq(profiles.isCurrent, true)) });
  if (!profileRow?.parsedData) return NextResponse.json({ error: "Finish onboarding (upload your CV) first." }, { status: 422 });
  const p = normalizeProfile(profileRow.parsedData);
  const prefs = await db.query.preferences.findFirst({ where: eq(preferences.userId, user.id) });
  const contact = (prefs?.onboarding as { contact?: { linkedin?: string; portfolio?: string } } | null)?.contact ?? {};

  const facts = JSON.stringify({
    name: p.full_name || user.name,
    summary: p.summary,
    topSkills: p.skills?.slice(0, 10),
    recentRole: p.experience?.[0] ? `${p.experience[0].title} at ${p.experience[0].company}` : undefined,
    linkedin: p.links?.linkedin || contact.linkedin,
    portfolio: p.links?.portfolio || contact.portfolio,
  });

  const isDm = contactKind === "dm";
  const anthropic = new Anthropic({ apiKey });
  const msg = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 800,
    messages: [{
      role: "user",
      content: `Draft a short ${isDm ? "direct message (DM)" : "job application email"} from the CANDIDATE applying for this role.

CANDIDATE (use only these facts):
${facts}

ROLE: ${title || "the role"}${company ? ` at ${company}` : ""}
JOB CONTEXT:
${(jd || "").slice(0, 2500)}

Rules:
- First person, warm, professional, the candidate's real voice. ${isDm ? "2 to 4 sentences, concise and friendly (a DM)." : "120 to 200 words."}
- Reference the specific role. State briefly why they fit, from their real experience only. Never invent facts.
- ${isDm ? "Include their LinkedIn or portfolio link if available (you cannot attach a CV in a DM)." : "Mention that their CV is attached. Optionally include LinkedIn/portfolio."}
- Plain, simple English. Do NOT use any dash characters (hyphen, en dash, em dash).
Return ONLY JSON: {"subject":"${isDm ? "" : "<short subject>"}","body":"<message>"}.`,
    }],
  });
  logUsage("draft_message", msg);
  const part = msg.content.find((c) => c.type === "text");
  const raw = part && "text" in part ? part.text : "";
  let subject = "";
  let body = "";
  try {
    const parsed = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1)) as { subject?: string; body?: string };
    subject = stripDashes(parsed.subject ?? "");
    body = stripDashes(parsed.body ?? "");
  } catch {
    body = stripDashes(raw);
  }

  return NextResponse.json({ to: contactValue ?? "", kind: contactKind ?? "email", subject, body });
}
