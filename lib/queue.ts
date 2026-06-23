import { PgBoss } from "pg-boss";
import type { Ats } from "@/lib/db/schema";

// Postgres-backed job queue (pg-boss). No Redis — runs on our existing Postgres
// in its own `pgboss` schema. Used by the Next.js app (enqueue) and the worker (process).
export const QUEUES = {
  PARSE_CV: "parse_cv",
  DISCOVER_COMPANY: "discover_company",
  DISCOVER_AGGREGATOR: "discover_aggregator",
  SCORE_USER: "score_user",
  TAILOR_APPLICATION: "tailor_application",
  SUBMIT_APPLICATION: "submit_application", // cloud submit: fill + submit in a headless browser
  DISCOVER_TICK: "discover_tick", // cron-driven: crawl boards + score every onboarded user
  DISCOVER_YC: "discover_yc", // cron-driven (daily): probe the YC directory + enroll new ATS boards
  INTERVIEW_REMINDER: "interview_reminder", // delayed: nudge before an interview-prep call
  AUTO_GRAB_CODE: "auto_grab_code", // delayed: pull an emailed OTP from Gmail and resume a paused submit
} as const;

export type ParseCvJob = { profileId: string; cvPublicId: string };
export type DiscoverCompanyJob = { companyId: string; slug: string; ats: Ats };
export type DiscoverAggregatorJob = { source: "remoteok" | "weworkremotely" | "myjobmag" | "jobberman" | "thehub" | "himalayas" };
export type ScoreUserJob = { userId: string };
export type TailorApplicationJob = { applicationId: string; embellish?: boolean };
export type SubmitApplicationJob = { applicationId: string };
export type InterviewReminderKind = "24h" | "1h" | "10min";
export type InterviewReminderJob = { bookingId: string; kind: InterviewReminderKind };
export type AutoGrabCodeJob = { applicationId: string; attempt: number };

declare global {
  // eslint-disable-next-line no-var
  var __sasaBoss: Promise<PgBoss> | undefined;
}

async function createBoss(): Promise<PgBoss> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required for the job queue.");
  const boss = new PgBoss({ connectionString });
  boss.on("error", (err) => console.error("[pg-boss] error:", err));
  await boss.start();
  await boss.createQueue(QUEUES.PARSE_CV);
  await boss.createQueue(QUEUES.DISCOVER_COMPANY);
  await boss.createQueue(QUEUES.DISCOVER_AGGREGATOR);
  await boss.createQueue(QUEUES.SCORE_USER);
  await boss.createQueue(QUEUES.TAILOR_APPLICATION);
  await boss.createQueue(QUEUES.SUBMIT_APPLICATION);
  await boss.createQueue(QUEUES.DISCOVER_TICK);
  await boss.createQueue(QUEUES.DISCOVER_YC);
  await boss.createQueue(QUEUES.INTERVIEW_REMINDER);
  await boss.createQueue(QUEUES.AUTO_GRAB_CODE);
  return boss;
}

// Cached on globalThis so we keep one instance across requests / HMR reloads.
export function getBoss(): Promise<PgBoss> {
  if (!globalThis.__sasaBoss) {
    globalThis.__sasaBoss = createBoss();
  }
  return globalThis.__sasaBoss;
}

export async function enqueueParseCv(data: ParseCvJob): Promise<string | null> {
  const boss = await getBoss();
  // Retries with exponential backoff if the worker handler throws.
  return boss.send(QUEUES.PARSE_CV, data, { retryLimit: 5, retryBackoff: true });
}

export async function enqueueDiscoverCompany(data: DiscoverCompanyJob): Promise<string | null> {
  const boss = await getBoss();
  return boss.send(QUEUES.DISCOVER_COMPANY, data, { retryLimit: 3, retryBackoff: true });
}

export async function enqueueDiscoverAggregator(data: DiscoverAggregatorJob): Promise<string | null> {
  const boss = await getBoss();
  return boss.send(QUEUES.DISCOVER_AGGREGATOR, data, { retryLimit: 3, retryBackoff: true });
}

export async function enqueueScoreUser(data: ScoreUserJob, startAfterSeconds = 0): Promise<string | null> {
  const boss = await getBoss();
  return boss.send(QUEUES.SCORE_USER, data, { retryLimit: 3, retryBackoff: true, startAfter: startAfterSeconds });
}

export async function enqueueTailorApplication(data: TailorApplicationJob): Promise<string | null> {
  const boss = await getBoss();
  return boss.send(QUEUES.TAILOR_APPLICATION, data, { retryLimit: 3, retryBackoff: true });
}

export async function enqueueSubmitApplication(data: SubmitApplicationJob): Promise<string | null> {
  const boss = await getBoss();
  // Cloud submit is heavy (a headless browser) and must not double-submit, so no
  // automatic retries — a failed run lands in needs_user/failed for the user.
  return boss.send(QUEUES.SUBMIT_APPLICATION, data, { retryLimit: 0 });
}

// Schedule a reminder to fire at a specific time (24h / 1h / 10min before a call).
// `startAfter` is the absolute Date to deliver at; pg-boss holds it until then.
export async function enqueueInterviewReminder(data: InterviewReminderJob, startAfter: Date): Promise<string | null> {
  const boss = await getBoss();
  return boss.send(QUEUES.INTERVIEW_REMINDER, data, { retryLimit: 3, retryBackoff: true, startAfter });
}

// Poll Gmail (after a short delay) for the verification code a paused submission is
// waiting on. No retries — the handler re-enqueues itself until it finds one or gives up.
export async function enqueueAutoGrabCode(data: AutoGrabCodeJob, startAfterSeconds = 8): Promise<string | null> {
  const boss = await getBoss();
  return boss.send(QUEUES.AUTO_GRAB_CODE, data, { retryLimit: 0, startAfter: startAfterSeconds });
}
