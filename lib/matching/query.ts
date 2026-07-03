import Anthropic from "@anthropic-ai/sdk";
import { and, or, eq, gte, ilike, desc, notInArray, type SQL } from "drizzle-orm";
import { db } from "@/lib/db";
import { jobs, matches, companies } from "@/lib/db/schema";
import { logUsage } from "@/lib/anthropic-usage";
import { scoreJobsForUser } from "@/lib/matching/score";
import { canUseSasa } from "@/lib/can-use";

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

// Build the job-table filter conditions for an intent (shared by the stored-match
// query and the on-demand fresh-scoring fallback).
function jobFilters(intent: Intent): SQL[] {
  const c: SQL[] = [];
  if (intent.locations.length) {
    const x = or(...intent.locations.map((l) => ilike(jobs.location, `%${l}%`)));
    if (x) c.push(x);
  }
  if (intent.remote) {
    const x = or(ilike(jobs.remotePolicy, "%remote%"), ilike(jobs.location, "%remote%"));
    if (x) c.push(x);
  }
  if (intent.internship) c.push(ilike(jobs.title, "%intern%"));
  if (intent.sponsorship) {
    const x = or(ilike(jobs.rawJd, "%sponsor%"), ilike(jobs.rawJd, "%visa%"), ilike(jobs.rawJd, "%relocat%"));
    if (x) c.push(x);
  }
  if (intent.keywords.length) {
    const x = or(...intent.keywords.flatMap((k) => [ilike(jobs.title, `%${k}%`), ilike(jobs.rawJd, `%${k}%`)]));
    if (x) c.push(x);
  }
  return c;
}

const MIN_SCORE = 40; // don't surface weak fits
const ENOUGH = 3; // stored matches at or above this count skip the fresh-scoring fallback
const FRESH_CANDIDATES = 15; // jobs scored on demand when stored matches are thin (~2 Haiku calls)

// Search the user's roles for a plain-language request, ranked by match score.
// First checks already-scored matches (free). If those are thin AND the user has
// credits, it scores a small batch of fresh jobs matching the query on demand, so a
// niche request ("visa sponsorship roles in Berlin") still returns something.
export async function searchRolesForUser(userId: string, query: string, limit = 6): Promise<RoleResult[]> {
  const intent = await parseIntent(query);
  const filters = jobFilters(intent);

  // 1. Stored matches — free.
  const stored = await db
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
    .where(and(eq(matches.userId, userId), eq(jobs.isActive, true), gte(matches.score, MIN_SCORE), ...filters))
    .orderBy(desc(matches.score))
    .limit(limit);

  const results: RoleResult[] = stored.map((r) => ({
    jobId: r.jobId,
    title: r.title,
    company: r.company,
    location: r.location,
    score: r.score,
    reason: (r.reasons as { reason?: string } | null)?.reason,
  }));

  // Enough stored matches, or the user can't spend on scoring — return what we have.
  if (results.length >= ENOUGH) return results;
  if (!(await canUseSasa(userId)).ok) return results;

  // 2. On-demand: score fresh jobs matching the query that aren't scored yet.
  const scoredRows = await db.select({ jobId: matches.jobId }).from(matches).where(eq(matches.userId, userId));
  const scoredIds = scoredRows.map((m) => m.jobId);

  const fresh = await db
    .select({ id: jobs.id, title: jobs.title, location: jobs.location, rawJd: jobs.rawJd, company: companies.name })
    .from(jobs)
    .innerJoin(companies, eq(jobs.companyId, companies.id))
    .where(and(eq(jobs.isActive, true), scoredIds.length ? notInArray(jobs.id, scoredIds) : undefined, ...filters))
    .orderBy(desc(jobs.discoveredAt))
    .limit(FRESH_CANDIDATES);
  if (fresh.length === 0) return results;

  const scored = await scoreJobsForUser(userId, fresh.map((f) => ({ id: f.id, title: f.title, location: f.location, rawJd: f.rawJd })));
  const scoreMap = new Map(scored.map((s) => [s.jobId, s]));

  const freshResults: RoleResult[] = fresh
    .filter((f) => (scoreMap.get(f.id)?.score ?? 0) >= MIN_SCORE)
    .map((f) => {
      const s = scoreMap.get(f.id)!;
      return { jobId: f.id, title: f.title, company: f.company, location: f.location, score: s.score, reason: s.reason };
    });

  // Merge, dedupe by job, rank, cap.
  const merged = [...results, ...freshResults];
  const seen = new Set<string>();
  return merged
    .filter((r) => (seen.has(r.jobId) ? false : (seen.add(r.jobId), true)))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
