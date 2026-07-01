# Tasks: Chrome Extension

## Backend (verifiable)
- [ ] T001 schema: jobs.url + users.extensionTokenHash; migrate; store url in crawl + crawl-aggregator
- [ ] T002 lib/credits.ts: getBalance, ensureSignupBonus(5), chargeForSubmission
- [ ] T003 lib/extension-auth.ts: resolve user from Bearer token (sha256 compare)
- [ ] T004 /api/extension/token (session issue), /api/extension/queue (Bearer), /api/extension/report (Bearer + charge)
- [ ] T005 /dashboard/settings: connect-extension token UI

## Mapper (verifiable)
- [ ] T006 extension/lib/greenhouse-map.ts: pure field-mapper (both board generations)
- [ ] T007 fixture test for the mapper

## Extension (build-verified)
- [ ] T008 WXT scaffold: wxt.config, background, popup, greenhouse content script
- [ ] T009 wxt build passes; gitignore extension/.output + .wxt

## Verify
- [ ] T010 credits + token + queue/report verified vs DB; mapper test passes; next build + wxt build pass
