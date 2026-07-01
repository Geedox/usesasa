# Tasks: Per-Role Tailoring

## Phase 1: Schema
- [ ] T001 `applications.tailoredCv` (jsonb) + `applications.tailoringValidation` (jsonb); generate + migrate

## Phase 2: Engine
- [ ] T002 `lib/tailoring/generate.ts` — Sonnet: profile + job + settings -> {experience[], coverLetter, answers}
- [ ] T003 `lib/tailoring/validate.ts` — Haiku: profile facts + generated content -> {fabrications[]} (Constitution II gate)
- [ ] T004 `lib/tailoring/tailor.ts` — orchestrate: load app/profile/job, generate, validate, regen once if fabricated, persist (state awaiting_review | needs_user)

## Phase 3: Queue + trigger
- [ ] T005 `lib/queue.ts` + `worker/index.ts` — `tailor_application` queue + handler (retries)
- [ ] T006 `app/api/applications/tailor/route.ts` — POST {matchId}: upsert draft application + enqueue
- [ ] T007 Dashboard match "Apply" button calls the trigger

## Phase 4: Verify
- [ ] T008 Real profile + job: tailoring produces bullets + 200-350w letter + 3 answers; stored on app
- [ ] T009 Validator flags an injected fabrication and passes clean content; flagged output -> needs_user
- [ ] T010 Build passes; 0 credits charged
