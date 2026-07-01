# Implementation Plan: Per-Role Tailoring

**Branch**: `004-tailoring` | **Date**: 2026-06-17 | **Spec**: [spec.md](./spec.md)

## Summary

For a chosen match, create a draft application and (in a queued worker job) generate rewritten CV
bullets + cover letter + custom answers with Sonnet, then run a Haiku validator that blocks/flags any
content not grounded in the canonical profile. Store original+rewritten bullets, the letter, answers,
and the validation result on the application (`awaiting_review`).

## Technical Context

**Stack**: pg-boss worker (tailor job), Claude Sonnet (generate) + Haiku (validate), Drizzle/Postgres.
**Storage**: `applications` — add `tailoredCv` (jsonb: original+rewritten bullets) and `tailoringValidation` (jsonb). Reuse `coverLetterText`, `customAnswers`, `state`.

## Constitution Check

- **II. Never Invent Facts (NON-NEGOTIABLE)** — central: prompt grounds only in profile; a validator pass detects fabrications; flagged output is never auto-approved. PASS by design.
- **I. Trust / nothing silent** — output goes to `awaiting_review` for the diff view; never auto-sent.
- **V. Cost** — Sonnet only for the generate step; Haiku for validation; no re-score.
- No violations.

## Source Code

```text
lib/tailoring/generate.ts   # Sonnet: profile + job + settings -> {experience[], coverLetter, answers}
lib/tailoring/validate.ts   # Haiku: profile facts + generated content -> {fabrications[]}
lib/tailoring/tailor.ts     # orchestrate: load, generate, validate (regen once), persist on application
lib/queue.ts                # + TAILOR_APPLICATION queue + enqueue
worker/index.ts             # + tailor handler
app/api/applications/tailor/route.ts  # POST {matchId} -> create draft application + enqueue
app/dashboard/page.tsx      # match "Apply" -> calls the trigger
lib/db/schema.ts            # applications.tailoredCv, applications.tailoringValidation (jsonb)
```

## Approach notes

- **Trigger**: "Apply" on a match → `POST /api/applications/tailor` → upsert a draft `applications` row for (user, job) → enqueue `tailor_application`.
- **Generate** (Sonnet): one structured prompt → JSON `{ experience: [{company,title,rewrittenBullets[]}], coverLetter, answers:{whyCompany,whyRole,recentProject} }`. Grounded strictly in the profile; honor tone/optimization from onboarding `applicationSettings`.
- **Validate** (Haiku): given the profile's facts (companies, titles, skills, dates, metrics) + the generated text, return `{ fabrications: string[] }`. Non-empty → regenerate once, feeding the fabrications back as "must not include". Still non-empty → store + set `state = needs_user` (flagged), not auto-approvable.
- **Persist**: `tailoredCv` keeps original + rewritten bullets per role (for the diff view); `coverLetterText`, `customAnswers`, `tailoringValidation`; `state = awaiting_review` (clean) or `needs_user` (flagged). No credits.
- **Out of scope**: the diff-view UI (next), PDF generation, submission.
