# Implementation Plan: Job Discovery & Matching (Greenhouse)

**Branch**: `003-job-discovery-matching` | **Date**: 2026-06-17 | **Spec**: [spec.md](./spec.md)

## Summary

Add a Greenhouse discovery client, seed watched companies, crawl their boards into `jobs` (durable
worker job, idempotent), score jobs against each user's profile (cheap pre-filter → cached LLM
score) into `matches`, and render real matches on the dashboard. Greenhouse only.

## Technical Context

**Stack**: Next.js (dashboard query + trigger route), pg-boss worker (crawl + score jobs), Drizzle/Postgres, Claude (Haiku) for scoring.
**External**: Greenhouse board API (`boards-api.greenhouse.io/v1/boards/<slug>/jobs?content=true`), no auth.
**Storage**: `companies`, `jobs`, `matches` (all already in schema §7.3).

## Constitution Check

- **V. Quality over volume / cost** — PASS: pre-filter before LLM, cache scores per `(profile_version, job_id)`, Haiku not Sonnet for scoring.
- **II. Never invent facts** — N/A here (scoring reads, doesn't generate user content).
- No violations.

## Source Code

```text
lib/ats/greenhouse.ts        # fetch + map Greenhouse postings -> normalized job rows
lib/ats/companies.seed.ts    # seed list of sponsor-friendly Greenhouse slugs
lib/discovery/crawl.ts       # upsert companies' jobs into `jobs` (idempotent)
lib/matching/score.ts        # pre-filter + LLM score; write `matches` (cached)
worker/index.ts              # + queues: discover_company, score_user
lib/queue.ts                 # + queue names + enqueue helpers
app/api/discovery/run/route.ts   # manual trigger (enqueue crawl for all companies + score current user)
app/dashboard/page.tsx       # query real matches for the user; empty state
```

## Approach notes

- **Discovery**: `fetchGreenhouseJobs(slug)` → normalize → `crawlCompany(companyId, slug)` upserts into `jobs` with `onConflictDoNothing` on `(source, external_id)`. One queued job per company so a slow/404 board doesn't block others (retries via pg-boss).
- **Seed**: insert companies on first run / via the trigger (idempotent on `(ats, ats_slug)`).
- **Pre-filter** (no LLM): from `preferences` — role family keyword match on title, seniority, location/remote, salary floor if present, sponsorship need vs company signal. Cheap boolean gate.
- **Score**: for survivors not already scored for `(profile_version, job_id)`, call Haiku with the JD + profile summary → `{score, reasons}`; insert into `matches` (unique `(user_id, job_id)`, `onConflictDoNothing`). Threshold ≥70 surfaced (store all, surface ≥70 on dashboard; ≥90 = high).
- **Dashboard**: replace placeholder array with a query: matches join jobs+companies for the user, score ≥70, order by score desc. Keep the existing card UI; empty state when none.
- **Trigger**: `POST /api/discovery/run` enqueues a crawl for each company then a score job for the current user. Also runnable from the worker on a schedule later (pg-boss cron) — manual for now.
- **Out of scope**: WhatsApp alerts, sponsorship enrichment, apply/tailor.
