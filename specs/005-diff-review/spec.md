# Feature Specification: Application Review & Diff View

**Feature Branch**: `005-diff-review`

**Created**: 2026-06-17

**Status**: Draft

**Input**: "Before anything is submitted, show the user exactly what changed: old vs new CV bullets with highlighting, the cover letter, and the custom answers — editable. They approve to queue it. If the validator flagged a possible fabrication, warn loudly."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Review what will be sent (Priority: P1)

For a tailored application, the user sees the job, the rewritten CV bullets **side-by-side with the
originals (changes highlighted)**, the cover letter, and the custom answers — all editable — then
clicks Approve to queue it. Nothing is sent without this review (Constitution I).

**Why this priority**: This is the trust surface. The user must see and control exactly what goes out.

**Independent Test**: Open a tailored application, confirm the diff shows original vs rewritten bullets
with highlights, edit a bullet + the cover letter, save, reload, and see the edits persisted.

**Acceptance Scenarios**:

1. **Given** a tailored application, **When** opened, **Then** each rewritten bullet is shown against its original with the changed words highlighted; the cover letter and answers are shown and editable.
2. **Given** the user edits content, **When** they save, **Then** the edits persist on the application.
3. **Given** the user clicks Approve, **When** confirmed, **Then** the application moves to `queued` (ready for the extension to submit).
4. **Given** the application is still tailoring (`drafted`), **When** opened, **Then** a processing state is shown until it's ready.

### User Story 2 - Loud fabrication warning (Priority: P1)

If the no-fabrication validator flagged anything, the review screen shows a clear warning listing the
flagged claims, so the user fixes them before approving.

**Why this priority**: Constitution II — the user must never unknowingly send fabricated content.

**Acceptance Scenarios**:

1. **Given** a tailoring run flagged fabrications, **When** the review opens, **Then** a prominent warning lists each flagged claim.
2. **Given** flagged content, **When** the user edits it out and saves, **Then** they can approve with confidence (the warning explains what to fix).

### Edge Cases

- Bullet unchanged → shown with no highlights.
- Application has no tailored content yet → processing state, not a broken/empty form.
- User edits then navigates away → unsaved-changes guard.
- Approving a flagged (`needs_user`) application is allowed but only after the warning is shown (the user decides).

## Requirements *(mandatory)*

- **FR-001**: The review MUST show, per experience, the original bullets vs the rewritten bullets with changed words highlighted.
- **FR-002**: The cover letter and each custom answer MUST be shown and editable; the CV bullets MUST be editable.
- **FR-003**: Edits MUST be savable and persist on the application.
- **FR-004**: Approving MUST move the application to `queued`; nothing is submitted from this screen (the extension submits later).
- **FR-005**: If `tailoringValidation.clean` is false, the screen MUST prominently warn and list the flagged claims.
- **FR-006**: While the application is `drafted` (tailoring in progress), the screen MUST show a processing state and update when ready.
- **FR-007**: The user MUST be able to reach this screen from the applications list; access is restricted to the owner.
- **FR-008**: Unsaved edits MUST NOT be lost silently.

### Key Entities

- **Application**: holds `tailoredCv` (original + rewritten bullets), `coverLetterText`, `customAnswers`, `tailoringValidation`, and `state`. Read + updated here.

## Success Criteria *(mandatory)*

- **SC-001**: A user can see exactly what changed (highlighted), edit any part, save, and approve in one screen.
- **SC-002**: Edits persist across reload.
- **SC-003**: Approve sets `queued`; no submission happens from the review screen.
- **SC-004**: A flagged application always shows the warning before it can be approved.

## Assumptions

- Tailoring (feature 004) has produced and stored the content; this feature renders/edits/approves it.
- The Chrome extension (later) consumes `queued` applications to submit.
- Char/word-level diff is computed client-side from stored original + rewritten bullets (no extra storage).
- PDF generation of the final tailored CV happens at/after submission (out of scope here).
