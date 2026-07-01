# Feature Specification: Per-Role Tailoring (CV, Cover Letter, Answers)

**Feature Branch**: `004-tailoring`

**Created**: 2026-06-17

**Status**: Draft

**Input**: "The prep stage. For a chosen match, rewrite the CV bullets to align with the job, draft a cover letter in the user's voice, and draft answers to common application questions — all derived only from the canonical profile, never invented (Constitution II). An output validator enforces this."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Tailored materials for a match (Priority: P1)

The user picks a match and Sasa produces, for that specific role: a rewritten set of CV bullets aligned
to the job's keywords, a cover letter in their voice, and drafted answers to common questions ("Why
this company?", "Why this role?", "Describe a recent project"). The result is stored on a draft
application for review.

**Why this priority**: This is the core "prep" value and the gate before anything is submitted.

**Independent Test**: For a profile + a real job, run tailoring and confirm rewritten bullets, a cover
letter (200–350 words), and three answers are produced and stored on a draft application.

**Acceptance Scenarios**:

1. **Given** a match + a parsed profile, **When** tailoring runs, **Then** a draft application is created with rewritten CV bullets, a cover letter, and custom answers.
2. **Given** the job description emphasizes certain skills the user has, **When** bullets are rewritten, **Then** those true skills are surfaced/emphasized (rephrased, not invented).
3. **Given** tailoring completes, **When** stored, **Then** the application moves to "awaiting_review".

### User Story 2 - Never invent facts (Priority: P1, NON-NEGOTIABLE)

Tailoring may rephrase and re-emphasize the user's real experience, but must never add a skill,
employer, title, metric, or credential that isn't in the canonical profile. A validation pass checks
the generated content against the profile and blocks/flags fabrications.

**Why this priority**: Constitution II. A fabricated application destroys user trust and can cost them
the role. This gate is mandatory.

**Independent Test**: Feed a profile and force a generation; run the validator; confirm it flags any
claim not supported by the profile, and that flagged output is not silently approved.

**Acceptance Scenarios**:

1. **Given** generated content containing a company/skill/metric absent from the profile, **When** the validator runs, **Then** it reports that fabrication.
2. **Given** the validator reports fabrications, **When** tailoring finishes, **Then** the content is regenerated once with the issues fed back; if still fabricated, the application is flagged (not auto-approved).
3. **Given** clean generated content, **When** validated, **Then** it passes with no issues.

### Edge Cases

- Thin profile (few bullets/skills) → tailoring stays conservative; doesn't pad with invented content.
- Thin JD (e.g. SmartRecruiters summary) → still produces a reasonable, honest tailoring.
- LLM/JSON parse failure → retry (queued job); never store partial/garbled output as approved.
- Cover letter drifts over 350 words → trimmed/regenerated to range.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: For a match, the system MUST generate (a) rewritten CV bullets per relevant experience, (b) a cover letter (200–350 words) in the user's voice, (c) answers to "Why this company?", "Why this role?", "Describe a recent project".
- **FR-002**: All generated content MUST derive only from the canonical profile; it MUST NOT introduce skills, employers, titles, dates, metrics, or credentials absent from the profile.
- **FR-003**: A validation pass MUST check generated content against the profile and report any unsupported claim (fabrication).
- **FR-004**: If the validator finds fabrications, the system MUST regenerate once with the issues fed back; if still fabricated, the application MUST be flagged for the user (not auto-approved).
- **FR-005**: Tailoring MUST run as a durable queued job and store results on a draft application (`awaiting_review`).
- **FR-006**: The stored result MUST retain original vs rewritten bullets so a diff can be shown (next feature) and MUST store the validation outcome.
- **FR-007**: Tailoring MUST honor the user's settings (tone, optimization level) where present; "aggressive" still means true-facts-only (Constitution II).
- **FR-008**: Tailoring MUST NOT charge credits (credits debit only on successful submission).

### Key Entities

- **Application**: a draft for a (user, job) — holds tailored CV (original+rewritten bullets), cover letter, custom answers, validation result, and state.
- **Profile**: the canonical source of truth tailoring reads from; never written to here.

## Success Criteria *(mandatory)*

- **SC-001**: For a real profile + job, tailoring produces rewritten bullets + a 200–350 word cover letter + 3 answers, stored on a draft application.
- **SC-002**: The validator flags injected fabrications in 100% of a small test set, and passes clean content.
- **SC-003**: No tailoring output containing detected fabrications is left in an auto-approvable state.
- **SC-004**: Tailoring charges 0 credits.

## Assumptions

- Generation uses Claude **Sonnet** (quality), validation uses **Haiku** (cheap), per the cost guardrails.
- The canonical profile (`profiles.parsedData`) and a scored match exist before tailoring runs.
- The **diff view UI** (show old→new, approve/edit) is the next feature; this feature produces and validates the content + stores it for that view.
- Actual PDF generation of the tailored CV is deferred; we store structured rewritten bullets now (the PDF is produced at/After approval).
