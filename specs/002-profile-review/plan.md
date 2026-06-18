# Implementation Plan: Profile Review & Edit

**Branch**: `002-profile-review` | **Date**: 2026-06-17 | **Spec**: [spec.md](./spec.md)

## Summary

A `/dashboard/profile` page that loads the current user's parsed profile (`profiles.parsedData`),
renders every field as an editable form (including add/remove for experience entries and bullets),
validates required fields, and saves back to the canonical profile. Shows a processing state while
the parse is still running. This is the human gate before tailoring trusts the data.

## Technical Context

**Stack**: Next.js App Router (server page + client form), Drizzle/Postgres, Better Auth session, shadcn inputs.
**Storage**: `profiles.parsedData` (jsonb, shape per FRD §5.1.3) for the current (`is_current`) profile.
**Project Type**: Web app (in the dashboard shell).

## Constitution Check

- **II. Never Invent Facts** — PASS and directly served: this is the correction checkpoint; the UI only edits extracted data.
- **IV. Least-privilege** — PASS: authenticated, user edits only their own profile.
- Others N/A. No violations.

## Source Code

```text
app/dashboard/profile/page.tsx        # server: session + load current profile, branch on parsed state
components/profile/profile-editor.tsx # client: editable form for the Profile shape, save + validation
app/api/profile/route.ts              # GET (load) + PUT (save) the current profile's parsedData
lib/profile.ts                        # shared Profile TS type + a zod schema + helpers
```

## Approach notes

- **Type**: define the `Profile` type + zod schema in `lib/profile.ts` (matches FRD §5.1.3); reuse for validation on save.
- **Load**: server page reads the current profile. If `parsedData` is null → render a "still processing" state that polls `/api/onboarding/status` (reuse existing) and refreshes when done. If present → render the editor seeded with it.
- **Edit**: client form with sections (basics, links, summary, experience[], education[], skills[], certifications[], languages[]); arrays support add/remove; bullets editable per experience.
- **Save**: `PUT /api/profile` validates with zod (required: full_name, email), writes `parsedData` on the current profile. In place for v1 (versioning deferred per spec).
- **Unsaved-changes guard**: track dirty state; warn on navigate away (beforeunload) — lightweight.
- **Nav**: point the dashboard sidebar "Profile" link to `/dashboard/profile`.
