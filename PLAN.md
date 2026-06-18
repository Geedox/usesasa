# Sasa — Build Plan

> Derived from the FRD (working name "Mosi", shipped as **Sasa** — Swahili for "now").
> An AI agent that applies to jobs on behalf of busy African professionals.
> Solo developer + Claude Code. This is the engineering execution plan; the FRD is the source of truth for requirements.

---

## 0. Guiding constraints (don't violate these)

1. **Submission runs in the user's own browser** via the Chrome extension, using their session — never server-side automation. Non-negotiable (ban risk + credential safety).
2. **The tailoring model may rephrase but never invent** experience, skills, or credentials. Enforced by prompt + an output-validation pass that diffs generated bullets against the canonical profile.
3. **Nothing is sent silently.** Every application is reviewable and reversible; default 1h auto-send delay, user-configurable.
4. **Credits debit only on successful submission.** Failed submissions auto-refund.
5. **Gmail scope is `gmail.readonly` only.** We store only emails that match an application.

---

## 1. Architecture at a glance

| Layer | Choice |
|-------|--------|
| Web dashboard | Next.js (App Router) + TS — **this repo**, deployed on Railway |
| Chrome extension | TS + Manifest V3 via WXT (separate package) |
| Database | **Postgres** (own instance — Railway Postgres in prod, Docker locally) |
| ORM / migrations | **Drizzle** (TS-first, SQL-close; Prisma is the alt if you prefer) |
| Auth | **Better Auth** — Google OAuth + email/password — Drizzle/Postgres adapter, sessions in Postgres. **Two-step consent:** sign in with basic Google scopes (profile/email) first; request **`gmail.readonly`** (offline access) later as a separate in-context step ("Connect Gmail to track replies") via Better Auth's additional-scopes flow. Refresh token stored encrypted for the worker to poll Gmail |
| File storage (CVs, tailored PDFs) | **Cloudinary** — same in dev and prod; PDFs/DOCX uploaded as `raw`/`auto`, served via signed (authenticated) URLs since CVs are private |
| Background jobs / webhooks | **Next.js Route Handlers** for webhooks (Paystack, WhatsApp, Gmail push) + a small **Node worker service** (Dockerized) for the crawler/match/email-poll, on a schedule (node-cron or Railway cron) |
| UI | shadcn/ui + Tailwind (already installed here) |
| Forms | react-hook-form + zod (already installed) |
| LLM | Anthropic Claude — Sonnet for tailoring/matching, Haiku for classification |
| Email | Gmail API (OAuth + Pub/Sub push) |
| WhatsApp | Meta WhatsApp Cloud API |
| Payments | Paystack (NGN; cards/bank/USSD/mobile money) |
| Hosting | **Railway** (web + worker + Postgres), Docker for local dev |
| Monitoring | Sentry (errors) + PostHog (product) |

> **No Supabase.** We self-host Postgres and replace the four things Supabase bundled: Auth → Better Auth, Storage → Cloudinary, Edge Functions → Next.js route handlers + a Node worker, Realtime → not needed for MVP (the dashboard polls). The FRD's Supabase references (§7) are superseded by this section.

Repo strategy: turn this repo into a **monorepo** (pnpm workspaces) so the dashboard and extension share types.

```
/apps/web         → Next.js dashboard (current code moves here, or stays at root for v1)
/apps/worker      → Node service: crawler, match scorer, email poller (scheduled)
/apps/extension   → WXT Chrome extension
/packages/types   → shared zod schemas + TS types (Profile, Job, Application, ...)
/packages/db      → Drizzle schema, migrations, and the shared DB client
/packages/ats     → per-ATS discovery clients + field-mapping modules
docker-compose.yml → Postgres (+ web + worker) for one-command local dev
```
> v1 shortcut: keep the dashboard at repo root; add `/worker`, `/extension`, and a `/db` dir; use `docker-compose` for local Postgres. Cloudinary is a hosted service, so no storage container is needed locally. Promote to formal workspaces only if the type-sharing pain justifies it.

---

## 2. Phased delivery (mirrors FRD §9)

### Phase 1 (Wk 1–3) — Core loop, one source, no payments
**Goal:** submit one real application end-to-end on a real Greenhouse form.

- [ ] Postgres (Docker locally / Railway in prod) + Drizzle schema & migration (all tables from FRD §7.3; we own the `users` table — no `auth.users`)
- [ ] `docker-compose.yml` for local dev (Postgres) — one command to boot
- [ ] Better Auth wired into Next.js — Google OAuth + email/password — Drizzle adapter, sessions in Postgres. Login requests **basic scopes only** (profile/email); Gmail access is a separate step later (Phase 2)
- [ ] CV upload → Cloudinary (private/authenticated, `raw`/`auto`) → LLM parse (Sonnet) → structured `Profile`
- [ ] Profile review/edit UI (mandatory step — parse hallucinations must be caught here)
- [ ] Onboarding wizard (basic info → CV → review → work auth → target roles → sponsorship → **voice & expectations** → notifications) — see §3a
- [ ] Voice & expectations capture (one-time) + learn-from-edits loop — see §3a
- [ ] Greenhouse discovery client (`boards-api.greenhouse.io/v1/boards/<slug>/jobs`), top ~50 sponsor-friendly slugs seeded
- [ ] Cheap pre-filter + LLM match scorer (cached by `(profile_version, job_id)`)
- [ ] Matches feed UI (score, reasons, "apply")
- [ ] Tailoring: CV rewrite + cover letter + custom answers (Sonnet) **with output validator**
- [ ] Diff view UI (old→new bullets, char-level highlight, inline edit, approve/queue)
- [ ] WXT extension scaffold + auth handshake with backend
- [ ] Greenhouse field-mapping module + form-fill content script
- [ ] Manual queue: approve → extension opens tab → fills → submits → reports back
- **Exit:** match → tailor → review → submit works on a sandbox Greenhouse posting.

### Phase 2 (Wk 3–5) — Tracking + notifications
- [ ] **"Connect Gmail" step** (in-context, after login): request `gmail.readonly` + offline access as an additional scope via Better Auth, with a consent UI explaining it's read-only and used only to follow up and track recruiter responses. Store the refresh token encrypted.
- [ ] Gmail `watch` Pub/Sub subscription using that grant (only for users who connected Gmail)
- [ ] Next.js route handler: Pub/Sub push receiver → fetch message → Haiku classifier → route to application by sender domain
- [ ] Pipeline status transitions (applied → viewed → replied → interview → rejected → offer)
- [ ] WhatsApp Cloud API setup; **submit the 7 templates for Meta review in week one of this phase** (1–3 day approval)
- [ ] `match_alert` + `submitted_receipt` flows working end-to-end
- [ ] Daily digest job

### Phase 3 (Wk 5–7) — Multi-source + payments
- [ ] Lever discovery (`api.lever.co/v0/postings/<slug>`)
- [ ] Ashby discovery (`api.ashbyhq.com/posting-api/job-board/<slug>`)
- [ ] Wellfound + YC Work at a Startup discovery
- [ ] Per-ATS field maps for Lever/Ashby/Wellfound/YC submission
- [ ] Paystack: server init → checkout → webhook → credit ledger
- [ ] Credit packs + ledger + auto-refund on failed submission
- [ ] Free trial: 5 credits on signup
- **Exit:** 10 paying friends, each ≥5 submissions and ≥1 recruiter reply.

### Phase 4 (Wk 7–9) — Polish + beta launch
- [ ] Sponsorship signal layer (UK sponsor CSV ingest, JD pattern scrape, per-company labels)
- [ ] Auto-send queue with configurable delay (0/30m/2h/24h/manual)
- [ ] Application history + Kanban tracker
- [ ] Pricing page, landing page (this site), AI disclosure
- [ ] Beta bug-fix pass; public launch (X, LinkedIn, Lagos tech communities)

### Phase 5+ — Remote OK, We Work Remotely, more ATSes, local NG boards (Jobberman/MyJobMag), referrals, interview prep. Workday + LinkedIn deferred until quality bar is high.

---

## 3a. Voice & expectations (one-time capture + self-correcting loop)

**Why:** the success metric is "90% of generated CVs/letters need no edits before approval" (FRD §10). Corrections come from the model guessing tone, length, and what claims are off-limits. We kill them by pinning that down **once** at onboarding — not by ingesting noisy chat history (see `DECISIONS.md`). What reduces edits is the *quality* of a few structured inputs, not the *volume* of context.

### One-time capture (added as an onboarding step)

Stored on the profile (extends `writing_sample` in the `profiles` table, FRD §7.3).

1. **Voice sample** — user pastes ONE piece of writing that sounds like them (a past cover letter, bio, a good email, or even a ChatGPT/Claude answer they felt nailed their voice). Optional but encouraged. One curated sample beats a 5,000-message dump.
2. **In-their-words answers** — 2–3 short prompts reused later as raw material, never freestyled from:
   - "Why are you looking to move?"
   - "Describe a project you're proud of."
   - "What do you want your next role to look like?"
3. **Explicit expectations** — the settings that usually cause hand-edits:
   - Tone: formal / warm / direct (pick one)
   - Cover-letter length: short (~150) / standard (~250) / detailed (~350)
   - **Do-not-say list** — claims, titles, or framing the user never wants made
   - Must-mention wins — achievements to surface when relevant
   - Deal-breakers — things that disqualify a role (e.g. on-site only, no sponsorship)

These feed the tailoring prompt (§ Phase 1 tailoring) as voice + guardrails, alongside the canonical profile. The do-not-say list is enforced by the same output-validator that blocks invented facts.

### Self-correcting loop (cheap, compounding)

When the user edits a draft before approving, diff their edit against the generated text and extract a lightweight "preference delta" (tone nudge, phrasing they removed, a fact they cut). Append to the profile's voice notes. Effect: the one-time setup keeps sharpening on its own, so corrections trend toward zero without the user doing anything. Implement after the core loop works; gate behind a cap so it can't bloat the profile or cost.

> Scope: the capture step is MVP (Phase 1). The learn-from-edits loop is a fast follow — build once tailoring + diff-approve are working and you can measure edit rate.

---

## 3. Build order rationale

The riskiest, most fragile pieces get tests early (FRD §12.7):
- **Per-ATS field mapping** — unit-test the DOM→field map per ATS with saved HTML fixtures.
- **LLM output validation** — test that tailoring rejects any bullet introducing a fact absent from the canonical profile.

Everything mocks cleanly: matching can run on seeded `jobs` rows before the crawler exists; the diff view works on a static tailored artifact before the model is wired.

---

## 4. Cost guardrails (FRD §6.5 — target < $3.50/active user/mo)

- Cache match scores and tailoring per `(profile_version, job_id)`.
- Haiku for classification; Sonnet only for tailoring + match scoring.
- Pre-filter cheaply (location/seniority/role/salary/sponsorship) **before** any LLM call.

---

## 5. External setup checklist (long lead times — start early)

- [ ] Meta Business + WhatsApp Business number + **submit 7 templates** (1–3 days)
- [ ] Google Cloud project: OAuth consent screen + Gmail API + Pub/Sub topic. ⚠️ `gmail.readonly` is a **restricted scope** — production use needs Google OAuth verification + a CASA security assessment (weeks of lead time). Start this early; test under the 100-user unverified cap meanwhile.
- [ ] Paystack account + business verification
- [ ] Railway project: Postgres database service + web service + worker service
- [ ] Cloudinary account + cloud name, API key & secret (and a signed upload preset for CVs)
- [ ] Better Auth secret (`BETTER_AUTH_SECRET`) + Google OAuth client ID/secret (same Google project as Gmail; `gmail.readonly` + offline access added to the requested scopes)
- [ ] Anthropic API key + spend limits

---

## 6. Open questions to resolve with founder (FRD §11.2)

- Managed "we review before send" premium SKU? (₦50k–₦100k/mo)
- Block vs. warn when applying to known non-sponsors?
- Open-source the extension for recruiter-side legitimacy?
- Referral / free-credit program by Phase 4?

See `DECISIONS.md` for choices made along the way.
