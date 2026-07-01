# Feature Specification: User Authentication & Sessions

**Feature Branch**: `001-user-auth`

**Created**: 2026-06-17

**Status**: Draft

**Input**: User description: "Authentication foundation for Sasa — Better Auth with **Google OAuth only** (founder decision; no email/password). Sessions in Postgres. Login requests basic Google scopes only; gmail.readonly is requested later as a separate in-context step (two-step consent)."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - One-click sign-up & sign-in with Google (Priority: P1)

A busy professional lands on the dashboard and chooses "Continue with Google". They approve a
consent screen that asks **only** for their basic profile and email (no inbox access). An account
is created on first sign-in (or they're signed into their existing one), and they arrive in the
authenticated app.

**Why this priority**: Google sign-in is the only sign-in path; everything else depends on it.
Keeping the login consent to basic scopes protects sign-up conversion (the heavier Gmail ask comes
later, in context).

**Independent Test**: With Google credentials configured, click "Continue with Google", approve
consent, and confirm a `users` row exists and an authenticated session is established.

**Acceptance Scenarios**:

1. **Given** a new visitor, **When** they complete Google sign-in, **Then** a user record is created, a session is started, and they land on the authenticated dashboard.
2. **Given** a returning user, **When** they sign in with the same Google account, **Then** they are signed into their existing account (no duplicate user).
3. **Given** the Google consent screen, **When** it is shown, **Then** it requests only basic profile/email scopes — never `gmail.readonly`.
4. **Given** a user who cancels/denies the Google consent, **When** they return, **Then** no account/session is created and a clear message is shown.

---

### User Story 2 - Stay signed in, sign out, and protected routes (Priority: P2)

A signed-in user stays signed in across visits, can sign out, and cannot reach authenticated pages
(dashboard, profile, applications) without a valid session.

**Why this priority**: Session lifecycle and route protection make the auth usable and safe, but
depend on P1 existing first.

**Independent Test**: Sign in, close and reopen the app (session persists), visit a protected route
while signed out (redirected to login), and sign out (session ends).

**Acceptance Scenarios**:

1. **Given** a signed-in user, **When** they revisit within the session lifetime, **Then** they remain authenticated without re-authenticating.
2. **Given** a signed-out (or never-authenticated) visitor, **When** they open a protected route, **Then** they are redirected to the login page.
3. **Given** a signed-in user, **When** they sign out, **Then** the session is invalidated and protected routes are no longer accessible.

---

### Edge Cases

- OAuth provider returns an error or the user denies consent → graceful failure, no partial account.
- Expired or tampered session token → treated as unauthenticated.
- Concurrent sessions on multiple devices → all valid until individually signed out or expired.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow sign-up and sign-in via Google OAuth, requesting **only** basic profile and email scopes at this step.
- **FR-002**: System MUST NOT request `gmail.readonly` (or any restricted/sensitive scope) during login; such scopes are granted later via a separate, in-context authorization step (the "Connect Gmail" feature).
- **FR-003**: System MUST create a single user identity per Google account; a returning user signs into the same account (no duplicate user).
- **FR-004**: System MUST persist sessions server-side (in Postgres) so users remain signed in across visits until expiry or sign-out.
- **FR-005**: Users MUST be able to sign out, which invalidates their current session.
- **FR-006**: System MUST protect authenticated routes — unauthenticated requests are redirected to the login page and never see protected data.
- **FR-007**: System MUST expose the current user/session to the app (server and client) so features can identify the acting user.
- **FR-008**: System MUST handle auth failures gracefully (denied consent, expired tokens) with clear, non-leaky messages.
- **FR-009**: The `users` record MUST be the one owned by the app (per the existing schema), extended as needed by the auth system rather than duplicated.

### Key Entities *(include if feature involves data)*

- **User**: the person's single identity — name, email, image, created/updated timestamps. Owned by the app; referenced by all domain tables.
- **Session**: an authenticated session for a user — token/handle, expiry, device/agent metadata; server-side so it can be revoked.
- **Account**: a link between a User and the Google provider, holding provider identifiers and tokens.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A new user can go from the login page to an authenticated dashboard via Google in under 30 seconds and no more than 3 clicks.
- **SC-002**: The Google login consent screen requests only basic profile/email scopes (0 sensitive scopes) — verifiable on the consent screen and in the OAuth request.
- **SC-003**: ≥99% of completed Google OAuth flows result in an authenticated session.
- **SC-004**: 100% of protected routes redirect unauthenticated users to login (no protected data is ever served without a valid session).
- **SC-005**: A returning user's session persists across browser restarts within the configured session lifetime without re-authentication.

## Assumptions

- Auth is **Google OAuth only** — per the founder. The FRD §5.1.1 also listed email/password and magic links; those are **explicitly dropped** for v1 (revisit only if needed).
- Auth is implemented with **Better Auth** on **Postgres**, per the constitution and `PLAN.md`/`DECISIONS.md`.
- Google OAuth credentials are available in the environment (`GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`).
- The auth system adopts/extends the existing app-owned `users` table; it adds session/account/verification storage as needed.
- **Connecting Gmail for recruiter-reply tracking is OUT OF SCOPE here** — it is the second step of the two-step consent and belongs to the email-tracking feature (Phase 2). This spec only guarantees login does not request it.
- MFA, non-Google providers, and team/multi-user accounts are out of scope for v1.
- Session lifetime uses a sensible default to be finalized in the plan.
