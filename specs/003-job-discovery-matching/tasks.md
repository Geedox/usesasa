# Tasks: Job Discovery & Matching (Greenhouse)

## Phase 1: Discovery

- [ ] T001 `lib/ats/greenhouse.ts` — `fetchGreenhouseJobs(slug)`: call board API, strip HTML, map to normalized rows; verify against live API
- [ ] T002 `lib/ats/companies.seed.ts` — list of sponsor-friendly Greenhouse slugs + `seedCompanies()` (idempotent)
- [ ] T003 `lib/discovery/crawl.ts` — `crawlCompany(companyId, slug)`: fetch + upsert into `jobs` (`onConflictDoNothing` on source+external_id), set `last_crawled_at`

## Phase 2: Matching

- [ ] T004 `lib/matching/score.ts` — `prefilter(profile, prefs, job)` (no LLM) + `scoreJob(profile, job)` (Haiku → {score, reasons})
- [ ] T005 `scoreUser(userId)`: load current profile + prefs, pre-filter candidate jobs, skip pairs already scored, score survivors, insert into `matches` (unique user+job)

## Phase 3: Queue + trigger

- [ ] T006 `lib/queue.ts` + `worker/index.ts` — `discover_company` and `score_user` queues + handlers (retries)
- [ ] T007 `app/api/discovery/run/route.ts` — POST: seed companies, enqueue crawl per company + score for current user

## Phase 4: Dashboard

- [ ] T008 `app/dashboard/page.tsx` — query real matches (join jobs+companies, score ≥70, desc); render cards; empty state when none
- [ ] T009 A "Find jobs" action on the dashboard that calls the trigger (so it's testable without the schedule)

## Phase 5: Verify

- [ ] T010 Live Greenhouse fetch returns jobs; crawl is idempotent (no dup jobs); scoring caches (no dup matches); build passes
