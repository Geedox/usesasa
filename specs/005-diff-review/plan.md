# Implementation Plan: Application Review & Diff View

**Branch**: `005-diff-review` | **Date**: 2026-06-17 | **Spec**: [spec.md](./spec.md)

## Summary

A review screen at `/dashboard/applications/[id]` that renders the tailored application: per-experience
bullet diffs (original vs rewritten, changed words highlighted), the cover letter, and the custom
answers — all editable. Save persists edits; Approve moves the app to `queued`. A loud banner shows if
the validator flagged fabrications. A processing state covers `drafted`. The applications list links here.

## Technical Context

**Stack**: Next.js (server page + client editor), Drizzle/Postgres, Better Auth session. Word-diff is a
small local util (no dependency). No LLM here.

## Constitution Check

- **I. Trust / nothing silent** — central: this is the mandatory review before queueing; approve only moves to `queued`, never submits.
- **II. Never invent facts** — surfaces the validator result so the user fixes flagged claims.
- No violations.

## Source Code

```text
lib/diff.ts                                   # word-level LCS diff -> tokens (same/added/removed)
app/dashboard/applications/[id]/page.tsx      # server: load app(+job,company), guard owner, branch on state
components/applications/review.tsx            # client: diff bullets + cover letter + answers + warning + save/approve
components/applications/processing.tsx        # client: 'tailoring…' state, polls + refreshes
app/api/applications/[id]/route.ts            # PUT: save edited tailoredCv/coverLetter/answers
app/api/applications/[id]/approve/route.ts    # POST: state -> queued
app/dashboard/page.tsx                        # applications table -> real rows, status badges, links
```

## Approach notes

- **Diff**: `lib/diff.ts` tokenizes by word (keeping spaces) and runs an LCS to produce `{value,type}` tokens. The review renders each rewritten bullet against its original; recomputed live as the user edits (cheap).
- **Editing**: rewritten bullets, cover letter, and answers are editable; the diff display updates as they type. Dirty state → beforeunload guard.
- **Save**: `PUT /api/applications/[id]` validates ownership, writes `tailoredCv` (rewritten bullets), `coverLetterText`, `customAnswers`.
- **Approve**: `POST /api/applications/[id]/approve` sets `state = queued` (owner only). No submission.
- **Processing**: if `state === drafted`, show a poller that `router.refresh()`es until tailoring sets `awaiting_review`/`needs_user`.
- **Warning**: if `tailoringValidation.clean === false`, a red banner lists `fabrications` at the top.
- **List**: dashboard "All applications" table queries the user's applications (join job+company), shows status + links to the review page; status counts in the tabs.
- **Out of scope**: actual submission (extension), PDF generation, auto-send timer.
