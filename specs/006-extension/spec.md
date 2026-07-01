# Feature Specification: Chrome Extension — Submit Applications

**Feature Branch**: `006-extension` | **Created**: 2026-06-17 | **Status**: Draft

**Input**: "Submit queued applications from the user's own browser via a Chrome extension (MV3, WXT). Greenhouse first. The extension pairs to the account, pulls queued applications, fills the form (every field + the open-ended answers + the CV), submits, and reports back. Credits debit on successful submission."

## User Scenarios & Testing

### US1 - Submit a queued application from my browser (P1)
A user with the extension installed and paired, who has an approved (`queued`) application, has the
extension open the Greenhouse posting, fill the form from their profile + tailored answers, submit,
and mark it submitted. Submission happens in the **user's own session** (Constitution III), never server-side.

**Acceptance**:
1. Given a `queued` application + a paired extension, when the user runs it, then the Greenhouse form is filled (name, email, phone, links, résumé, cover letter, custom answers) and submitted.
2. On success, the application becomes `submitted` and **1 credit is debited**.
3. On a field the extension can't handle, the application becomes `needs_user` and is **not** charged.
4. The extension acts in the user's logged-in session; we never store ATS credentials.

### US2 - Pairing & credits (P1)
The extension authenticates as the user via a pairing token (cookies don't cross the extension origin),
and only submits while the user has credits.

**Acceptance**:
1. The user copies a connect token from the web app and pastes it into the extension; the extension authenticates with it.
2. New users start with 5 free credits; the extension won't submit with 0 credits.

### Edge Cases
- Two Greenhouse board generations (boards.greenhouse.io vs job-boards.greenhouse.io) → field map handles both or flags needs_user.
- Form changed / field not found → needs_user, not a silent failure.
- Human-required question (e.g. unexpected free-text) → needs_user.
- Rate/bot patterns → randomized 8–25s delays between field actions.

## Requirements
- **FR-001**: The extension MUST pull the user's `queued` applications with the data to fill (profile fields, tailored CV ref, cover letter, custom answers) and the apply URL.
- **FR-002**: It MUST fill and submit Greenhouse forms in the user's own browser session (no server-side automation, no stored ATS creds — Constitution III).
- **FR-003**: On success it MUST report `submitted` and the backend MUST debit exactly 1 credit; on failure/needs_user it MUST NOT debit.
- **FR-004**: Unmapped/unknown fields MUST set `needs_user` (never submit a half-filled form silently).
- **FR-005**: Auth is a per-user pairing token (Bearer); the backend validates it.
- **FR-006**: New users get 5 free credits; the backend MUST refuse to charge below 0 (no submission without credits).
- **FR-007**: The extension MUST pace actions with randomized delays to avoid bot patterns.

## Success Criteria
- **SC-001**: The Greenhouse field-mapper correctly identifies the standard fields on saved form fixtures (unit-tested).
- **SC-002**: Backend: pairing resolves a user; queue returns only `queued` apps with fill data; report transitions state and debits exactly 1 credit on success, 0 otherwise.
- **SC-003**: The extension builds (MV3) and loads unpacked.
- **SC-004**: No ATS credentials are ever stored or sent to our servers.

## Assumptions
- **Greenhouse only** for the first cut (Lever/Ashby/Workday mappers come next; Workday deferred).
- Live form submission is verified manually in a browser (cannot be headless); this spec's automated tests cover the mapper + backend.
- Résumé file: the extension downloads the user's CV (signed Cloudinary URL from the backend) and attaches it.
- Payments/top-up (Paystack) are Phase 3; here we grant the 5 free credits and debit on submit.
