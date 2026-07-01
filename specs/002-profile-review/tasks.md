# Tasks: Profile Review & Edit

## Phase 1: Foundational

- [ ] T001 `lib/profile.ts` — `Profile` TS type + zod schema (FRD §5.1.3) + an `emptyProfile()` helper
- [ ] T002 `app/api/profile/route.ts` — GET current profile parsedData; PUT validates (zod) + saves to current profile

## Phase 2: US1 — Review & correct (P1)

- [ ] T003 [US1] `components/profile/profile-editor.tsx` — editable form: basics, links, summary, experience[] (+bullets), education[], skills[], certifications[], languages[]; add/remove rows; dirty tracking
- [ ] T004 [US1] Required-field validation (full name, email) with inline messaging; save via PUT
- [ ] T005 [US1] `app/dashboard/profile/page.tsx` — session guard, load current profile; if parsedData null → processing state (poll status); else render editor
- [ ] T006 [US1] Unsaved-changes warning (beforeunload) when dirty

## Phase 3: US2 — Edit anytime (P2)

- [ ] T007 [US2] Point sidebar "Profile" link to `/dashboard/profile`
- [ ] T008 [US2] Verify load → edit → save → reload persists

## Phase 4: Polish

- [ ] T009 Build passes; saved-state indicator; processing state matches brand (dash-free copy)
