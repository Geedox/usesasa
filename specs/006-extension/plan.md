# Plan: Chrome Extension — Submit Applications

**Branch**: 006-extension | **Spec**: ./spec.md

## Summary
WXT MV3 extension that pairs to the account (Bearer token), pulls `queued` applications + fill data
from the backend, opens each Greenhouse posting, fills + submits in the user's session, and reports
back; backend debits 1 credit on success. Greenhouse first.

## Constitution Check
- III. Submit from user's browser — central (the extension is the only submitter; no server automation; no ATS creds).
- I. Nothing silent — unmapped fields => needs_user, never a silent half-submit.
- V. Outcome-aligned — debit exactly 1 credit on success; 0 on failure.

## Source
```
lib/credits.ts                         # balance, signup bonus (5), charge-on-submit
lib/extension-auth.ts                  # resolve user from Bearer pairing token (sha256)
app/api/extension/token/route.ts       # session: issue pairing token (store hash, return once)
app/api/extension/queue/route.ts       # Bearer: queued apps + fill data + balance
app/api/extension/report/route.ts      # Bearer: state transition + charge
app/dashboard/settings/page.tsx        # "Connect extension" token UI
lib/db/schema.ts                       # jobs.url, users.extensionTokenHash
extension/ (WXT)                       # wxt.config, background, popup, greenhouse content script, lib/greenhouse-map
```

## Approach
- **Auth**: cookies don't cross the extension origin (SameSite), so use a per-user Bearer pairing token. `/api/extension/token` (session) generates a token, stores its sha256 on the user, returns plaintext once. Extension stores it; sends `Authorization: Bearer`.
- **Queue**: returns `queued` apps with { applyUrl, fields(name/email/phone/links), coverLetter, answers, resumeUrl(signed) }, capped to the credit balance.
- **Report**: `submitted` => debit 1 (ledger) + set submitted_at; `needs_user`/`failed` => set state, no charge. Refuse charge if balance <= 0.
- **Field-mapper**: pure function over a document → locates standard Greenhouse fields (both board generations) → fill plan; unit-tested against saved HTML fixtures (the fragile part).
- **Extension**: background fetches queue, opens tabs, messages the content script with fill data; content script fills with randomized delays, submits, reports. Popup: paste token, show balance + queued count + run.
- **Out of scope**: Lever/Ashby/Workday mappers, multi-step (Workday) forms, auto-send timer.
