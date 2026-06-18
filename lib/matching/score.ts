import Anthropic from "@anthropic-ai/sdk";
import { and, desc, eq, gte, isNull, notInArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { jobs, matches, profiles, preferences, applications, users, companies } from "@/lib/db/schema";
import { normalizeProfile, type Profile } from "@/lib/profile";
import { enqueueTailorApplication } from "@/lib/queue";
import { notifyNewMatch } from "@/lib/telegram";

const MAX_CANDIDATES = 300; // jobs scored per run (batched, so ~30 LLM calls)
const BATCH_SIZE = 10; // jobs per Haiku call
export const MATCH_THRESHOLD = 60; // surface + auto-tailor at/above this score
const AUTO_TAILOR_LIMIT = 15; // top matches auto-prepared for review per run (no Telegram)
const NUDGE_PER_RUN = 15; // top new matches asked about on Telegram per run

const STOPWORDS = new Set([
  "with", "team", "lead", "senior", "junior", "staff", "and", "the", "for",
  "remote", "manager", "engineer", "developer", "intern", "contract",
]);

// Keywords from the profile (past titles + skills) — the cheap pre-filter uses
// these to drop obviously-irrelevant postings before any LLM call. Broader than
// titles alone so we don't throw away adjacent roles the candidate could fill.
function roleKeywords(p: Profile): string[] {
  const words = new Set<string>();
  const add = (text: string, minLen: number) => {
    for (const w of text.toLowerCase().split(/[^a-z0-9+]+/)) {
      if (w.length >= minLen && !STOPWORDS.has(w)) words.add(w);
    }
  };
  for (const e of p.experience) add(e.title, 3);
  for (const s of p.skills.slice(0, 30)) add(s, 3);
  return [...words];
}

function prefilter(keywords: string[], job: { title: string; rawJd: string }): boolean {
  if (keywords.length === 0) return true; // nothing to go on — let the LLM decide
  const hay = `${job.title} ${job.rawJd.slice(0, 400)}`.toLowerCase();
  return keywords.some((k) => hay.includes(k));
}

type ScoreResult = { score: number; reason: string };

function profileBlurb(p: Profile): string {
  return [
    p.summary,
    `Recent roles: ${p.experience.slice(0, 4).map((e) => `${e.title} at ${e.company}`).join("; ")}`,
    `Skills: ${p.skills.slice(0, 25).join(", ")}`,
  ].filter(Boolean).join("\n");
}

// Score a batch of jobs in one Haiku call. Returns one result per input job,
// in order. Falls back to score 0 for any the model omits.
async function scoreBatch(
  anthropic: Anthropic,
  blurb: string,
  batch: { title: string; location: string; rawJd: string }[],
): Promise<ScoreResult[]> {
  const jobList = batch
    .map((j, i) => `[${i}] ${j.title} — ${j.location}\n${j.rawJd.slice(0, 1200)}`)
    .join("\n\n---\n\n");

  const msg = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1200,
    messages: [
      {
        role: "user",
        content: `Score how well this candidate fits each job below, 0-100, with one short reason each.
Be realistic but not harsh: a transferable, adjacent role should score 55-75, a strong direct fit 80+.
Return ONLY a JSON array, one object per job, in the same order:
[{"i": <index>, "score": <0-100>, "reason": "<one sentence>"}]

CANDIDATE:
${blurb}

JOBS:
${jobList}`,
      },
    ],
  });

  const textPart = msg.content.find((c) => c.type === "text");
  const raw = textPart && "text" in textPart ? textPart.text : "";
  const json = raw.slice(raw.indexOf("["), raw.lastIndexOf("]") + 1);
  let parsed: { i: number; score: number; reason: string }[] = [];
  try {
    parsed = JSON.parse(json);
  } catch {
    parsed = [];
  }
  const byIndex = new Map(parsed.map((p) => [p.i, p]));
  return batch.map((_, i) => {
    const r = byIndex.get(i);
    return {
      score: r ? Math.max(0, Math.min(100, Math.round(r.score))) : 0,
      reason: r ? String(r.reason ?? "") : "",
    };
  });
}

// Score un-scored candidate jobs for a user and write matches (cached: pairs
// already in `matches` are skipped, so re-runs don't re-call the LLM).
export async function scoreUser(userId: string): Promise<{ scored: number }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

  const profileRow = await db.query.profiles.findFirst({
    where: and(eq(profiles.userId, userId), eq(profiles.isCurrent, true)),
  });
  if (!profileRow?.parsedData) return { scored: 0 };
  const profile = normalizeProfile(profileRow.parsedData);

  const prefs = await db.query.preferences.findFirst({ where: eq(preferences.userId, userId) });
  void prefs; // reserved for richer pre-filtering later

  const allJobs = await db.query.jobs.findMany({ where: eq(jobs.isActive, true) });

  // Skip jobs already scored for this user (cache).
  const existing = await db
    .select({ jobId: matches.jobId })
    .from(matches)
    .where(eq(matches.userId, userId));
  const seen = new Set(existing.map((m) => m.jobId));

  const keywords = roleKeywords(profile);
  const candidates = allJobs
    .filter((j) => !seen.has(j.id))
    .filter((j) => prefilter(keywords, { title: j.title, rawJd: j.rawJd ?? "" }))
    .sort((a, b) => (b.postedAt?.getTime() ?? 0) - (a.postedAt?.getTime() ?? 0))
    .slice(0, MAX_CANDIDATES);

  const anthropic = new Anthropic({ apiKey });
  const blurb = profileBlurb(profile);
  let scored = 0;

  for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
    const batch = candidates.slice(i, i + BATCH_SIZE);
    try {
      const results = await scoreBatch(
        anthropic,
        blurb,
        batch.map((j) => ({ title: j.title, location: j.location ?? "", rawJd: j.rawJd ?? "" })),
      );
      for (let k = 0; k < batch.length; k++) {
        const { score, reason } = results[k];
        await db
          .insert(matches)
          .values({
            userId,
            jobId: batch[k].id,
            profileVersion: profileRow.version,
            score,
            reasons: { reason },
            userAction: "pending",
          })
          .onConflictDoNothing({ target: [matches.userId, matches.jobId] });
        scored++;
      }
    } catch (err) {
      console.error("[score] batch failed:", batch.map((b) => b.id), err);
    }
  }

  // Surface the best new matches. With Telegram linked, the agent asks "Apply?"
  // first (gate 1) and only tailors after a Yes. Without it, fall back to
  // auto-tailoring the top matches so they sit ready on the dashboard.
  const surfaced = await surfaceNewMatches(userId);
  console.log(`[score] surfaced ${surfaced} new matches for ${userId}`);

  return { scored };
}

// Decide how to surface new matches based on whether the user linked Telegram.
async function surfaceNewMatches(userId: string): Promise<number> {
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (user?.telegramChatId) return nudgeNewMatches(userId, user.telegramChatId);
  return autoTailorTopMatches(userId);
}

// Gate 1: ask on Telegram about the top new matches (not yet nudged, not applied).
async function nudgeNewMatches(userId: string, chatId: string): Promise<number> {
  const applied = await db
    .select({ jobId: applications.jobId })
    .from(applications)
    .where(eq(applications.userId, userId));
  const appliedJobIds = applied.map((a) => a.jobId);

  const rows = await db
    .select({
      matchId: matches.id,
      jobId: matches.jobId,
      score: matches.score,
      reasons: matches.reasons,
      title: jobs.title,
      company: companies.name,
    })
    .from(matches)
    .innerJoin(jobs, eq(matches.jobId, jobs.id))
    .innerJoin(companies, eq(jobs.companyId, companies.id))
    .where(
      and(
        eq(matches.userId, userId),
        eq(matches.userAction, "pending"),
        isNull(matches.nudgedAt),
        gte(matches.score, MATCH_THRESHOLD),
        appliedJobIds.length ? notInArray(matches.jobId, appliedJobIds) : undefined,
      ),
    )
    .orderBy(desc(matches.score))
    .limit(NUDGE_PER_RUN);

  for (const r of rows) {
    await notifyNewMatch({
      chatId,
      jobId: r.jobId,
      company: r.company,
      title: r.title,
      score: r.score,
      reason: (r.reasons as { reason?: string } | null)?.reason,
    });
    await db.update(matches).set({ nudgedAt: new Date() }).where(eq(matches.id, r.matchId));
  }
  return rows.length;
}

// Create draft applications + enqueue tailoring for the user's top matches that
// don't already have an application. Returns how many were kicked off.
export async function autoTailorTopMatches(userId: string): Promise<number> {
  const applied = await db
    .select({ jobId: applications.jobId })
    .from(applications)
    .where(eq(applications.userId, userId));
  const appliedJobIds = applied.map((a) => a.jobId);

  const top = await db
    .select({ jobId: matches.jobId, id: matches.id })
    .from(matches)
    .where(
      and(
        eq(matches.userId, userId),
        gte(matches.score, MATCH_THRESHOLD),
        appliedJobIds.length ? notInArray(matches.jobId, appliedJobIds) : undefined,
      ),
    )
    .orderBy(desc(matches.score))
    .limit(AUTO_TAILOR_LIMIT);

  let started = 0;
  for (const m of top) {
    // onConflictDoNothing + the applications_user_job_unique constraint guarantees
    // one application per (user, job) even if two runs race — no repeat applications.
    const [created] = await db
      .insert(applications)
      .values({ userId, jobId: m.jobId, matchId: m.id, state: "drafted" })
      .onConflictDoNothing({ target: [applications.userId, applications.jobId] })
      .returning({ id: applications.id });
    if (created) {
      await enqueueTailorApplication({ applicationId: created.id });
      started++;
    }
  }
  return started;
}
