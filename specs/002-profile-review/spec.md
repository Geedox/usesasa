# Feature Specification: Profile Review & Edit

**Feature Branch**: `002-profile-review`

**Created**: 2026-06-17

**Status**: Draft

**Input**: "After the CV is parsed, the user reviews the auto-extracted profile and can fix anything wrong before it's used. Also editable anytime from the dashboard. This is the human gate against parse hallucinations (Constitution II)."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Review and correct the parsed profile (Priority: P1)

After uploading a CV, the user sees the structured profile Sasa extracted (name, contact, summary,
work experience with bullet points, education, skills, links) and can correct anything the parser
got wrong or hallucinated, then save it as the canonical profile.

**Why this priority**: The whole product trusts this profile to tailor CVs and answer application
questions. If the parse is wrong and unreviewed, every downstream application inherits the error.
This is the mandated human checkpoint (Constitution II).

**Independent Test**: With a parsed profile in the DB, open the profile page, edit a field and a
bullet, save, reload, and confirm the change persisted.

**Acceptance Scenarios**:

1. **Given** a parsed profile, **When** the user opens the profile page, **Then** every extracted field is shown and editable.
2. **Given** an edited field, **When** the user saves, **Then** the canonical profile is updated and the change persists across reloads.
3. **Given** the CV is still being parsed, **When** the user opens the page, **Then** a clear "still processing" state is shown instead of an empty form.
4. **Given** a required field (name, email) is cleared, **When** the user tries to save, **Then** saving is blocked with a clear message.

### User Story 2 - Edit the profile anytime (Priority: P2)

A returning user opens Profile from the dashboard to update details (new skill, fixed title, added
experience) at any time, not just during onboarding.

**Why this priority**: Profiles change; the same screen serves onboarding review and ongoing edits.
Secondary because it reuses US1's screen.

**Independent Test**: From the dashboard, navigate to Profile, make an edit, save, and see it reflected.

**Acceptance Scenarios**:

1. **Given** a signed-in user, **When** they open Profile from the sidebar, **Then** their current profile loads.
2. **Given** edits across multiple sections, **When** they save, **Then** all changes persist together.

### Edge Cases

- Parse produced empty arrays / missing sections → show empty, addable sections (don't crash).
- User adds or removes an experience entry or a bullet → supported.
- User navigates away with unsaved edits → warn (or autosave); at minimum, don't lose silently.
- No CV uploaded yet → prompt to upload (shouldn't normally happen post-onboarding).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST display the full parsed profile (full name, email, phone, location, links, summary, experience [company, title, dates, location, bullets], education, skills, certifications, languages).
- **FR-002**: Every field MUST be editable; experience entries and their bullets MUST be add/remove/editable.
- **FR-003**: Saving MUST persist the edited profile as the canonical profile used downstream.
- **FR-004**: System MUST validate required fields (full name, email) before saving.
- **FR-005**: While the CV is still parsing (no parsed data yet), the page MUST show a processing state, not an empty/broken form.
- **FR-006**: The page MUST be reachable from the dashboard Profile nav and require an authenticated session.
- **FR-007**: Edits MUST NOT silently lose data — either autosave or warn on unsaved changes.
- **FR-008**: The profile content is the source of truth for tailoring; nothing here invents data — it only lets the user correct what was extracted (Constitution II).

### Key Entities

- **Profile**: the canonical structured profile (`profiles.parsedData`, shape per FRD §5.1.3) for the current user — what the review screen reads and writes.

## Success Criteria *(mandatory)*

- **SC-001**: A user can correct a wrong field or bullet and the change persists across reload in under 30 seconds.
- **SC-002**: 100% of parsed fields are visible and editable on the page (no extracted data is hidden).
- **SC-003**: Saving with a cleared required field is always blocked with a clear message.
- **SC-004**: When parsing is still running, the user always sees a processing state (never an empty form mistaken for "no data").

## Assumptions

- Parsing is already implemented (queued, Claude) and writes `profiles.parsedData`.
- **Versioning/rollback** (FRD §5.1.4) is desirable but deferred: v1 saves edits in place to the current profile. The schema already has `version`/`is_current`, so version history can be added later without a redesign.
- The screen lives at `/dashboard/profile` and reuses the dashboard shell.
- CV re-upload + diff against the old profile (FRD §5.1.4) is out of scope here.
