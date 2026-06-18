# Tasks: User Authentication & Sessions

**Input**: `specs/001-user-auth/` (spec.md, plan.md)

**Organization**: grouped by user story (US1 Google, US2 email/password, US3 sessions/guards).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency)

## Phase 1: Setup

- [x] T001 Install `better-auth`
- [x] T002 Add env: `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` (Google creds already present)

## Phase 2: Foundational (blocks all stories)

- [x] T003 Create `lib/auth.ts` — Better Auth server: drizzle(postgres) adapter, **Google provider only** (basic scopes), session config
- [x] T004 Extend Drizzle schema: add Better Auth fields to `users` (`emailVerified`, `name`, `image`, `updatedAt`) + new `sessions`, `accounts`, `verifications` tables (`lib/db/schema.ts`)
- [x] T005 Generate + apply migration (`pnpm db:generate` → `pnpm db:migrate`); verify tables exist
- [x] T006 Create `app/api/auth/[...all]/route.ts` — mount Better Auth handler (GET/POST)
- [x] T007 Create `lib/auth-client.ts` — React client (signIn/signOut/useSession)
- [x] T008 Add a server helper `getSession()` for route handlers/server components

## Phase 3: US1 — Google one-click sign-in (P1)

- [x] T009 [US1] Login page `app/(auth)/login/page.tsx` with "Continue with Google" button only
- [x] T010 [US1] Wire Google sign-in via auth-client; confirm only basic scopes requested (FR-002)
- [x] T011 [US1] `app/dashboard/page.tsx` placeholder protected landing
- [ ] T012 [US1] Verify in browser: Google flow creates a `users` row + session (needs Google redirect URI registered)

## Phase 4: US2 — Sessions, sign-out, protected routes (P2)

- [x] T013 [US2] Route protection (`middleware.ts`) + server `getSession` gate → unauthenticated redirect to `/login`
- [x] T014 [US2] Sign-out action; session invalidated
- [x] T015 [US2] Verify: protected route blocks signed-out users (307 → /login); session works with cookie

## Phase 5: Polish

- [x] T016 Confirm `pnpm build` passes
- [x] T017 Re-check Constitution Principle IV (0 sensitive scopes at login)
- [ ] T018 Register Google OAuth redirect URIs (localhost + prod) and do a real browser sign-in
