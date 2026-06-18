import "./env"; // MUST be first — loads .env.local before other imports read process.env
import { getBoss, QUEUES, type ParseCvJob, type DiscoverCompanyJob, type DiscoverAggregatorJob, type ScoreUserJob, type TailorApplicationJob } from "../lib/queue";
import { parseCvForProfile } from "../lib/onboarding/parse";
import { crawlCompany } from "../lib/discovery/crawl";
import { crawlAggregator } from "../lib/discovery/crawl-aggregator";
import { scoreUser } from "../lib/matching/score";
import { tailorApplication } from "../lib/tailoring/tailor";
import { runAutonomousCycle } from "../lib/discovery/cycle";
import { startTelegramPolling } from "../lib/telegram";

// Cron for the autonomous cycle. Default: every 8 hours. Override with DISCOVERY_CRON.
const DISCOVERY_CRON = process.env.DISCOVERY_CRON || "0 */8 * * *";

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
      await tailorApplication(job.data.applicationId);
    }
  });

  // Autonomous cycle: crawl boards + score every onboarded user, no dashboard click.
  await boss.work(QUEUES.DISCOVER_TICK, async () => {
    console.log("[worker] discover_tick — running autonomous cycle");
    const { companies, users, renudged } = await runAutonomousCycle();
    console.log(`[worker] tick: queued ${companies} boards, scoring ${users} users, renudged ${renudged} stuck`);
  });

  // Register the recurring schedule (pg-boss upserts by name, so this is idempotent).
  await boss.schedule(QUEUES.DISCOVER_TICK, DISCOVERY_CRON);
  console.log(`[worker] autonomous cycle scheduled: "${DISCOVERY_CRON}"`);

  // Telegram review nudges: long-poll for /start links and Approve/Skip taps.
  void startTelegramPolling();

  console.log("[worker] started — listening for jobs");
}

main().catch((err) => {
  console.error("[worker] fatal:", err);
  process.exit(1);
});
