# Implementation Plan: User Authentication & Sessions

**Branch**: `001-user-auth` | **Date**: 2026-06-17 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/001-user-auth/spec.md`

## Summary

Add authentication to the Sasa Next.js app using **Better Auth** over the existing Postgres +
Drizzle foundation: **Google OAuth only** (basic scopes only — no email/password), server-side
sessions, route protection, and a single app-owned user identity. The two-step Gmail consent is
honored by requesting **no** sensitive scopes at login.

## Technical Context

**Language/Version**: TypeScript, Next.js (App Router) on Node 22+
**Primary Dependencies**: better-auth, drizzle-orm + postgres (existing)
**Storage**: Postgres (Docker locally @ 127.0.0.1:55432; Railway in prod) via Drizzle
**Testing**: manual + a unit test for the session/route-guard helper; auth flows verified by booting the app
**Target Platform**: Web (Railway)
**Project Type**: Web application (Next.js full-stack — UI + route handlers in one app)
**Performance Goals**: login → authenticated dashboard < 30s / ≤ 3 clicks (SC-001)
**Constraints**: login requests 0 sensitive scopes (SC-002); 100% protected-route redirect (SC-004)
**Scale/Scope**: MVP — single-user accounts, Google + email/password only

## Constitution Check

*GATE: must pass before and after design.*

- **IV. Least-Privilege & Reversible Consent** — PASS: login requests only profile/email; `gmail.readonly` deferred to a separate flow (FR-002). Account deletion/disconnect tracked for later features.
- **I. Trust / III. Browser-submit / V. Quality** — N/A to auth (no agent actions, no submission, no credits here).
- **II. Never Invent Facts** — N/A.
- No violations → Complexity Tracking not required.

## Project Structure

### Documentation (this feature)

```text
specs/001-user-auth/
├── spec.md       # done
├── plan.md       # this file
└── tasks.md      # next (/speckit-tasks)
```

### Source Code (repository root)

```text
lib/
├── auth.ts             # Better Auth server instance (providers, adapter, session config)
├── auth-client.ts      # Better Auth React client (signIn/signUp/signOut/useSession)
└── db/
    ├── schema.ts       # + sessions, accounts, verifications; users extended for Better Auth
    └── migrations/     # new migration for the auth tables

app/
├── api/auth/[...all]/route.ts   # Better Auth handler (GET/POST)
├── (auth)/login/page.tsx        # login UI (Continue with Google)
├── dashboard/page.tsx           # first protected route (placeholder)
└── middleware.ts                # protect authenticated routes

components/auth/                  # login form, google button, etc. (shadcn)
```

**Structure Decision**: Single Next.js app (full-stack). Auth server config in `lib/auth.ts`,
exposed via the catch-all route handler; client helpers in `lib/auth-client.ts`. Auth tables live
in the existing Drizzle schema so they migrate with everything else.

## Approach notes

- **Schema reconciliation**: extend the existing `users` table with the fields Better Auth needs
  (`emailVerified`, `name`, `image`, `updatedAt`) while keeping app fields (`fullName`, `phone`,
  `whatsappOptedIn`) as Better Auth `additionalFields`. Add `sessions`, `accounts`, `verifications`.
  Use `@better-auth/cli generate` to produce the exact expected columns, then merge + migrate.
- **IDs**: keep uuid PKs; configure Better Auth to use the DB-generated ids (so FKs from domain tables stay uuid).
- **Route protection**: a session check in middleware + server component; unauthenticated → `/login`.
- **No email/password** (founder decision): `emailAndPassword` disabled; no reset flow.
- **Out of scope** (later features): the "Connect Gmail" scope-grant step, account deletion, profile/onboarding.
