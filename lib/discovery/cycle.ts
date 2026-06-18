import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, applications } from "@/lib/db/schema";
import { seedCompanies } from "@/lib/ats/companies.seed";
import { enqueueDiscoverCompany, enqueueDiscoverAggregator, enqueueScoreUser } from "@/lib/queue";
import { notifySubmissionBlocked, notifyNeedsReview } from "@/lib/telegram";

// Enqueue a crawl of every watched board + the aggregators. Shared by the manual
// "Find jobs" button and the scheduled tick so they behave identically.
export async function enqueueCrawlAll(): Promise<number> {
  const all = await seedCompanies();
  for (const c of all) {
    await enqueueDiscoverCompany({ companyId: c.id, slug: c.atsSlug, ats: c.ats });
  }
  await enqueueDiscoverAggregator({ source: "remoteok" });
  await enqueueDiscoverAggregator({ source: "weworkremotely" });
  return all.length;
}

// Full autonomous cycle (no dashboard click): crawl boards, then score every
// onboarded user once discovery has had a head start. Scoring auto-tailors each
// user's top matches, so review-ready drafts pile up on their own.
export async function runAutonomousCycle(scoreDelaySeconds = 180): Promise<{ companies: number; users: number; renudged: number }> {
  const companies = await enqueueCrawlAll();

  const onboarded = await db
    .select({ id: users.id })
    .from(users)
    .where(isNotNull(users.onboardedAt));

  for (const u of onboarded) {
    await enqueueScoreUser({ userId: u.id }, scoreDelaySeconds);
  }

  // Re-surface anything stuck so it keeps coming back until it is submitted,
  // skipped, or passed.
  const renudged = await renotifyStuck();
  return { companies, users: onboarded.length, renudged };
}

// Re-send a Telegram nudge for every application still waiting on the user
// (needs_user or failed). Runs each cycle, so a missed message comes back. Once
// the user approves/skips/requeues, the application leaves these states and the
// nudges stop on their own.
export async function renotifyStuck(): Promise<number> {
  const linked = await db
    .select({ id: users.id })
    .from(users)
    .where(isNotNull(users.telegramChatId));

  let n = 0;
  for (const u of linked) {
    const stuck = await db
      .select({ id: applications.id, state: applications.state, note: applications.submissionNote })
      .from(applications)
      .where(and(eq(applications.userId, u.id), inArray(applications.state, ["needs_user", "failed"])));

    for (const a of stuck) {
      if (a.note) await notifySubmissionBlocked(a.id, a.state as "needs_user" | "failed", a.note);
      else await notifyNeedsReview(a.id);
      n++;
    }
  }
  return n;
}
