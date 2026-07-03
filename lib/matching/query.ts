import Anthropic from "@anthropic-ai/sdk";
import { and, or, eq, gte, ilike, desc, type SQL } from "drizzle-orm";
import { db } from "@/lib/db";
import { jobs, matches, companies } from "@/lib/db/schema";
import { logUsage } from "@/lib/anthropic-usage";

// A single role returned by an on-demand search (Telegram "find me X roles").
export type RoleResult = {
  jobId: string;
  title: string;
  company: string;
  location: string | null;
  score: number;
  reason?: string;
};

type Intent = {
  locations: string[];
  remote: boolean;
  internship: boolean;
  sponsorship: boolean;
  keywords: string[];
};

const STOP = new Set([
  "get", "me", "find", "roles", "jobs", "role", "job", "please", "show", "any",
  "some", "for", "in", "the", "a", "with", "and", "that", "give", "want", "looking",
  "need", "position", "positions", "opening", "openings", "work",
]);
const SPECIAL = ["remote", "visa", "sponsorship", "sponsor", "internship", "intern", "relocation", "relocate"];

// Cheap fallback intent parse (no LLM): enough for the common cases.
function heuristicIntent(q: string): Intent {
  const t = q.toLowerCase();
  const internship = /\bintern(ship)?s?\b/.test(t);
  const remote = /\bremote\b/.test(t);
  const sponsorship = /\b(visa|sponsor(ship)?|relocat)/.test(t);
  const locations: string[] = [];
  const m = t.match(/\bin ([a-z .,]+)/);
  if (m) locations.push(...m[1].split(/,| and /).map((s) => s.trim()).filter(Boolean).slice(0, 3));
  const keywords = t
    .split(/[^a-z0-9+#.]+/)
    .filter((w) => w.length > 2 && !STOP.has(w) && !SPECIAL.includes(w));
  return { locations, remote, internship, sponsorship, keywords: keywords.slice(0, 6) };
}

// Turn a free-text request into structured search filters. Uses Haiku (agentic,
// handles "visa sponsorship backend roles in Europe"), falling back to a keyword
// heuristic if the model is unavailable or errors.
async function parseIntent(q: string): Promise<Intent> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return heuristicIntent(q);
  try {
    const anthropic = new Anthropic({ apiKey, timeout: 20_000 });
    const msg = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      messages: [
        {
          role: "user",
          content: `Extract job-search filters from the request. Return ONLY JSON:
{"locations": string[], "remote": boolean, "internship": boolean, "sponsorship": boolean, "keywords": string[]}
- locations: cities, countries or regions mentioned (e.g. ["Lagos"], ["Europe"]). Empty if none.
- remote: true if they want remote work.
- internship: true if they want internships.
- sponsorship: true if they want visa sponsorship or relocation.
- keywords: role, skill or industry terms (e.g. ["backend","fintech"]). Do not repeat the flags above.

Request: "${q}"`,
        },
      ],
    });
    logUsage("telegram.query", msg);
    const part = msg.content.find((c) => c.type === "text");
    const raw = part && "text" in part ? part.text : "";
    const parsed = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1));
    return {
      locations: Array.isArray(parsed.locations) ? parsed.locations.map(String).slice(0, 3) : [],
      remote: !!parsed.remote,
      internship: !!parsed.internship,
      sponsorship: !!parsed.sponsorship,
      keywords: Array.isArray(parsed.keywords) ? parsed.keywords.map(String).slice(0, 6) : [],
    };
  } catch {
    return heuristicIntent(q);
  }
}

// Search the user's already-scored matches, filtered by what they asked for, ranked
// by match score. Read-only + free: it queries the matches the daily cycle produced,
// so no scoring cost is incurred per request.
export async function searchRolesForUser(userId: string, query: string, limit = 6): Promise<RoleResult[]> {
  const intent = await parseIntent(query);

  const conds: SQL[] = [eq(matches.userId, userId), eq(jobs.isActive, true), gte(matches.score, 40)];

  if (intent.locations.length) {
    const loc = or(...intent.locations.map((l) => ilike(jobs.location, `%${l}%`)));
    if (loc) conds.push(loc);
  }
  if (intent.remote) {
    const rem = or(ilike(jobs.remotePolicy, "%remote%"), ilike(jobs.location, "%remote%"));
    if (rem) conds.push(rem);
  }
  if (intent.internship) {
    conds.push(ilike(jobs.title, "%intern%"));
  }
  if (intent.sponsorship) {
    const sp = or(ilike(jobs.rawJd, "%sponsor%"), ilike(jobs.rawJd, "%visa%"), ilike(jobs.rawJd, "%relocat%"));
    if (sp) conds.push(sp);
  }
  if (intent.keywords.length) {
    const kw = or(...intent.keywords.flatMap((k) => [ilike(jobs.title, `%${k}%`), ilike(jobs.rawJd, `%${k}%`)]));
    if (kw) conds.push(kw);
  }

  const rows = await db
    .select({
      jobId: jobs.id,
      title: jobs.title,
      company: companies.name,
      location: jobs.location,
      score: matches.score,
      reasons: matches.reasons,
    })
    .from(matches)
    .innerJoin(jobs, eq(matches.jobId, jobs.id))
    .innerJoin(companies, eq(jobs.companyId, companies.id))
    .where(and(...conds))
    .orderBy(desc(matches.score))
    .limit(limit);

  return rows.map((r) => ({
    jobId: r.jobId,
    title: r.title,
    company: r.company,
    location: r.location,
    score: r.score,
    reason: (r.reasons as { reason?: string } | null)?.reason,
  }));
}
