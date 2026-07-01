# Feature Specification: Job Discovery & Matching (Greenhouse)

**Feature Branch**: `003-job-discovery-matching`

**Created**: 2026-06-17

**Status**: Draft

**Input**: "The 'find' stage. Pull real jobs from watched Greenhouse company boards, score each against the user's profile, and surface real matches on the dashboard (replacing placeholders). Greenhouse only for Phase 1."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See real, scored matches (Priority: P1)

After onboarding, the user opens the dashboard and sees real, recently-posted jobs from watched
companies, each with a match score and a short reason, sorted best-first — instead of placeholders.

**Why this priority**: This is the core value: the agent finds roles that fit you. Everything
downstream (tailor, apply) needs real matched jobs.

**Independent Test**: Seed companies, run discovery, run scoring for a profile, load the dashboard,
and confirm real jobs with scores appear sorted by score.

**Acceptance Scenarios**:

1. **Given** watched companies and a parsed profile, **When** discovery + scoring have run, **Then** the dashboard shows real jobs with a match score (0–100) and reason, best first.
2. **Given** a job that doesn't fit (wrong seniority/location/role), **When** scored, **Then** it scores low and is not surfaced (threshold ≥70).
3. **Given** the same job already surfaced, **When** scoring runs again, **Then** it is not duplicated (one match per user+job).
4. **Given** no matches yet (discovery not run / nothing fits), **When** the dashboard loads, **Then** a clear empty state is shown, not fake cards.

### User Story 2 - Discovery keeps running (Priority: P2)

New roles posted on watched boards show up over time without the user doing anything; discovery can
also be triggered manually for testing/seeding.

**Why this priority**: Freshness is the product promise ("apply first"), but depends on US1's pipeline.

**Independent Test**: Trigger discovery, confirm new jobs are inserted and existing ones aren't duplicated.

**Acceptance Scenarios**:

1. **Given** a watched company, **When** discovery runs, **Then** its current Greenhouse postings are stored (insert new, skip existing by source+external_id).
2. **Given** discovery runs twice, **When** the second run completes, **Then** no duplicate job rows are created.

### Edge Cases

- A company slug is invalid / board returns 404 → skip that company, keep going, log it.
- Greenhouse API is slow or errors → retry (queued job), don't crash discovery for other companies.
- A job has no usable description → still stored; scoring can handle thin content.
- Profile not parsed yet → no scoring for that user (nothing to match against).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST fetch postings from watched Greenhouse company boards via the public board API and store them in `jobs` (source, external_id, company, title, location, remote_policy, posted_at, raw_jd, parsed_jd).
- **FR-002**: Discovery MUST be idempotent — re-running inserts only new jobs (unique on source + external_id), never duplicates.
- **FR-003**: System MUST maintain a list of watched companies (`companies`) seeded with sponsor-friendly Greenhouse slugs.
- **FR-004**: For each user with a parsed profile, the system MUST run a cheap pre-filter (location/remote, seniority, role family, salary floor, sponsorship need) BEFORE any LLM call.
- **FR-005**: Surviving candidates MUST be scored 0–100 by an LLM with a short reason, and the result cached by `(profile_version, job_id)` (don't re-score unchanged pairs).
- **FR-006**: Roles scoring ≥70 MUST be surfaced as matches; ≥90 flagged "high".
- **FR-007**: Matches MUST be de-duplicated — one match per `(user, job)`; never resurface the same role.
- **FR-008**: The dashboard MUST display real matches (score + reason + company/title/location), sorted by score, with a clear empty state when there are none.
- **FR-009**: Discovery and scoring MUST run as durable queued jobs (worker), and be manually triggerable.

### Key Entities

- **Company**: a watched employer (`companies`): name, ats, ats_slug, sponsorship signals, last_crawled_at.
- **Job**: a discovered posting (`jobs`): source, external_id, title, location, remote_policy, posted_at, raw_jd, parsed_jd.
- **Match**: a scored job for a user (`matches`): score, reasons, profile_version, user_action; unique per user+job.

## Success Criteria *(mandatory)*

- **SC-001**: After discovery + scoring, the dashboard shows real jobs (0 placeholder cards) with scores and reasons.
- **SC-002**: Re-running discovery creates 0 duplicate jobs; re-running scoring creates 0 duplicate matches.
- **SC-003**: Only jobs scoring ≥70 appear; below-threshold jobs never surface.
- **SC-004**: Cost control — a job/profile pair is scored at most once (cache hit on re-run), and pre-filter removes obvious non-fits before any LLM call.

## Assumptions

- **Greenhouse only** for this slice (Lever/Ashby/Wellfound/YC come later per the plan).
- Greenhouse public board API needs no auth: `https://boards-api.greenhouse.io/v1/boards/<slug>/jobs?content=true`.
- Scoring uses Claude (Haiku for cheap scoring; cache aggressively) — `ANTHROPIC_API_KEY` is set.
- Pre-filter inputs come from `preferences` (target roles, seniority, locations, salary floor, sponsorship) captured at onboarding.
- WhatsApp match alerts, sponsorship-signal enrichment, and "apply" wiring are out of scope here.
