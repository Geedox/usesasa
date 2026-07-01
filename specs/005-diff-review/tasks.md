# Tasks: Application Review & Diff View

## Phase 1: Diff util
- [ ] T001 lib/diff.ts — word-level LCS diff -> tokens {value, type: same|added|removed}

## Phase 2: APIs
- [ ] T002 PUT /api/applications/[id] — owner-only save of tailoredCv (rewritten bullets), coverLetterText, customAnswers
- [ ] T003 POST /api/applications/[id]/approve — owner-only state -> queued

## Phase 3: Review UI
- [ ] T004 components/applications/review.tsx — diff bullets (editable), cover letter, answers, validation banner, save + approve, unsaved guard
- [ ] T005 components/applications/processing.tsx — drafted state poller
- [ ] T006 app/dashboard/applications/[id]/page.tsx — server load + guard + branch (processing | review)

## Phase 4: List
- [ ] T007 Wire dashboard "All applications" table to real applications (status badges, links, tab counts)

## Phase 5: Verify
- [ ] T008 Diff renders highlights; edits save + persist; approve -> queued; flagged app shows warning; build passes
