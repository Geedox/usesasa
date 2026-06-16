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
| Web dashboard | Next.js (App Router) + TS on Vercel — **this repo** |
| Chrome extension | TS + Manifest V3 via WXT (separate package) |
| Backend | Supabase: Postgres + Auth + Storage + Edge Functions |
| UI | shadcn/ui + Tailwind (already installed here) |
| Forms | react-hook-form + zod (already installed) |
| LLM | Anthropic Claude — Sonnet for tailoring/matching, Haiku for classification |
| Email | Gmail API (OAuth + Pub/Sub push) |
| WhatsApp | Meta WhatsApp Cloud API |
| Payments | Paystack (NGN; cards/bank/USSD/mobile money) |
| Monitoring | Sentry (errors) + PostHog (product) |

Repo strategy: turn this repo into a **monorepo** (pnpm workspaces) so the dashboard and extension share types.

```
/apps/web         → Next.js dashboard (current code moves here, or stays at root for v1)
/apps/extension   → WXT Chrome extension
/packages/types   → shared zod schemas + TS types (Profile, Job, Application, ...)
/packages/ats     → per-ATS discovery clients + field-mapping modules
/supabase         → migrations, Edge Functions
```
> v1 shortcut: keep the dashboard at repo root, add `/extension` and `/supabase` siblings, and a small `/shared` dir. Promote to formal workspaces only if the type-sharing pain justifies it.

---

## 2. Phased delivery (mirrors FRD §9)

### Phase 1 (Wk 1–3) — Core loop, one source, no payments
**Goal:** submit one real application end-to-end on a real Greenhouse form.

- [ ] Supabase project + schema migration (all tables from FRD §7.3)
- [ ] Supabase Auth wired into Next.js (Google OAuth + email/password)
- [ ] CV upload → Storage → LLM parse (Sonnet) → structured `Profile`
- [ ] Profile review/edit UI (mandatory step — parse hallucinations must be caught here)
- [ ] Onboarding wizard (basic info → CV → review → work auth → target roles → sponsorship → notifications)
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
- [ ] Gmail OAuth (`readonly`) + consent UI + `watch` Pub/Sub subscription
- [ ] Edge Function: push receiver → fetch message → Haiku classifier → route to application by sender domain
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
- [ ] Google Cloud project: OAuth consent screen + Gmail API + Pub/Sub topic (verification can take days)
- [ ] Paystack account + business verification
- [ ] Supabase project
- [ ] Anthropic API key + spend limits

---

## 6. Open questions to resolve with founder (FRD §11.2)

- Managed "we review before send" premium SKU? (₦50k–₦100k/mo)
- Block vs. warn when applying to known non-sponsors?
- Open-source the extension for recruiter-side legitimacy?
- Referral / free-credit program by Phase 4?

See `DECISIONS.md` for choices made along the way.
