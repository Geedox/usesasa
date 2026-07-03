import "./env"; // MUST be first — loads .env.local before other imports read process.env
import { getBoss, QUEUES, type ParseCvJob, type DiscoverCompanyJob, type DiscoverAggregatorJob, type ScoreUserJob, type TailorApplicationJob, type SubmitApplicationJob, type InterviewReminderJob, type AutoGrabCodeJob } from "../lib/queue";
import { parseCvForProfile } from "../lib/onboarding/parse";
import { crawlCompany } from "../lib/discovery/crawl";
import { crawlAggregator } from "../lib/discovery/crawl-aggregator";
import { scoreUser } from "../lib/matching/score";
import { tailorApplication } from "../lib/tailoring/tailor";
import { processSteelSubmission } from "../lib/submit/steel";
import { processAutoGrabCode } from "../lib/submit/autograb";
import { runAutonomousCycle } from "../lib/discovery/cycle";
import { discoverYcBoards } from "../lib/discovery/yc-discovery";
import { processInterviewReminder } from "../lib/interview/reminders";
import { startTelegramPolling } from "../lib/telegram";

// Cron for the autonomous cycle. Default: once daily (06:00). Every-8h was 3x the
// LLM spend for little benefit at this scale. Override with DISCOVERY_CRON.
const DISCOVERY_CRON = process.env.DISCOVERY_CRON || "0 6 * * *";
// YC board discovery runs daily (probing the whole directory is heavy). Override with YC_DISCOVERY_CRON.
const YC_DISCOVERY_CRON = process.env.YC_DISCOVERY_CRON || "0 4 * * *";

// Background worker. Runs as its own process/service (Railway worker service in prod).
// Add more `boss.work(...)` handlers here as we add jobs (crawler, match, email poll).
async function main() {
  const boss = await getBoss();

  await boss.work<ParseCvJob>(QUEUES.PARSE_CV, async (jobs) => {
    for (const job of jobs) {
      console.log(`[worker] parse_cv ${job.id} profile=${job.data.profileId}`);
      // Throwing here makes pg-boss retry (with backoff) per the send options.
      await parseCvForProfile(job.data.profileId, job.data.cvPublicId);
    }
  });

  await boss.work<DiscoverCompanyJob>(QUEUES.DISCOVER_COMPANY, async (jobs) => {
    for (const job of jobs) {
      console.log(`[worker] discover_company ${job.data.ats}:${job.data.slug}`);
      const n = await crawlCompany(job.data.companyId, job.data.slug, job.data.ats);
      console.log(`[worker] ${job.data.slug}: ${n} postings`);
    }
  });

  await boss.work<DiscoverAggregatorJob>(QUEUES.DISCOVER_AGGREGATOR, async (jobs) => {
    for (const job of jobs) {
      console.log(`[worker] discover_aggregator ${job.data.source}`);
      const n = await crawlAggregator(job.data.source);
      console.log(`[worker] ${job.data.source}: ${n} postings`);
    }
  });

  await boss.work<ScoreUserJob>(QUEUES.SCORE_USER, async (jobs) => {
    for (const job of jobs) {
      console.log(`[worker] score_user ${job.data.userId}`);
      const { scored } = await scoreUser(job.data.userId);
      console.log(`[worker] scored ${scored} jobs for ${job.data.userId}`);
    }
  });

  await boss.work<TailorApplicationJob>(QUEUES.TAILOR_APPLICATION, async (jobs) => {
    for (const job of jobs) {
      console.log(`[worker] tailor_application ${job.data.applicationId}`);
      await tailorApplication(job.data.applicationId, { embellishOverride: job.data.embellish });
    }
  });

  // Cloud submission: fill + submit the application in a headless browser. One at
  // a time (teamSize 1) — a headless Chromium is heavy and we must not race.
  await boss.work<SubmitApplicationJob>(QUEUES.SUBMIT_APPLICATION, { batchSize: 1, localConcurrency: 1 }, async (jobs) => {
    for (const job of jobs) {
      console.log(`[worker] submit_application ${job.data.applicationId}`);
      await processSteelSubmission(job.data.applicationId);
    }
  });

  // Interview-prep reminders: fire at 24h / 1h / 10min before each booked call.
  await boss.work<InterviewReminderJob>(QUEUES.INTERVIEW_REMINDER, async (jobs) => {
    for (const job of jobs) {
      console.log(`[worker] interview_reminder ${job.data.kind} booking=${job.data.bookingId}`);
      await processInterviewReminder(job.data.bookingId, job.data.kind);
    }
  });

  // Auto-grab an emailed verification code from Gmail and resume a paused submit.
  await boss.work<AutoGrabCodeJob>(QUEUES.AUTO_GRAB_CODE, async (jobs) => {
    for (const job of jobs) {
      console.log(`[worker] auto_grab_code attempt=${job.data.attempt} app=${job.data.applicationId}`);
      await processAutoGrabCode(job.data.applicationId, job.data.attempt);
    }
  });

  // Autonomous cycle: crawl boards + score every onboarded user, no dashboard click.
  await boss.work(QUEUES.DISCOVER_TICK, async () => {
    console.log("[worker] discover_tick — running autonomous cycle");
    const { companies, users, renudged, purged } = await runAutonomousCycle();
    console.log(`[worker] tick: queued ${companies} boards, scoring ${users} users, renudged ${renudged} stuck, purged ${purged} stale matches`);
  });

  // Auto-discovery: probe the YC directory for live ATS boards and enroll them, so we
  // cover companies nobody seeded. Daily (probing thousands every 8h would rate-limit).
  await boss.work(QUEUES.DISCOVER_YC, async () => {
    console.log("[worker] discover_yc — probing YC directory for ATS boards");
    const { scanned, hits, enrolled } = await discoverYcBoards();
    console.log(`[worker] yc discovery: scanned ${scanned}, ${hits} live boards, ${enrolled} newly enrolled`);
  });

  // The autonomous cycle costs LLM tokens (scoring + auto-tailoring), so it must run
  // on exactly ONE worker. Gate it behind RUN_DISCOVERY=1 (set on production only) so
  // a staging worker sharing the same Anthropic key does not double the spend. The
  // manual "Find jobs" button still works everywhere (it enqueues on demand).
  if (process.env.RUN_DISCOVERY === "1") {
    // Register the recurring schedules (pg-boss upserts by name, so these are idempotent).
    await boss.schedule(QUEUES.DISCOVER_TICK, DISCOVERY_CRON);
    await boss.schedule(QUEUES.DISCOVER_YC, YC_DISCOVERY_CRON);
    console.log(`[worker] schedules — cycle: "${DISCOVERY_CRON}", yc discovery: "${YC_DISCOVERY_CRON}"`);
  } else {
    // Clear any schedule a previous RUN_DISCOVERY=1 deploy left behind on this DB.
    await boss.unschedule(QUEUES.DISCOVER_TICK).catch(() => {});
    await boss.unschedule(QUEUES.DISCOVER_YC).catch(() => {});
    console.log("[worker] autonomous cycle disabled — set RUN_DISCOVERY=1 on exactly one worker to enable");
  }

  // Telegram review nudges: long-poll for /start links and Approve/Skip taps.
  void startTelegramPolling();

  console.log("[worker] started — listening for jobs");
}

main().catch((err) => {
  console.error("[worker] fatal:", err);
  process.exit(1);
});
