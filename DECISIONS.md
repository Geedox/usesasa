# DECISIONS

Architectural and product decisions made during the build that aren't fully specified in the FRD. Newest first.

---

## 2026-06-17 — Background jobs via pg-boss (Postgres-backed queue), with a worker

CV parsing (and later the crawler / match scorer / email poller) runs as **durable queued jobs**, not fire-and-forget in the request. Chose **pg-boss** because it runs entirely on our existing Postgres (its own `pgboss` schema) — no Redis, consistent with the "Postgres + Docker, no extra infra" decision. The Next.js app **enqueues** (`enqueueParseCv`); a separate **worker process** (`worker/index.ts`, run via `pnpm worker` / `worker:start`) processes jobs with retries + backoff. On Railway the worker is its own service. `parseCvForProfile` throws on operational errors so the queue retries; it returns without throwing when `ANTHROPIC_API_KEY` is unset (permanent skip, no retry storm). See `PLAN.md` §1 (background work).

## 2026-06-17 — Drop Supabase; use self-hosted Postgres + Docker

The FRD (§7) specced Supabase (Postgres + Auth + Storage + Edge Functions). We're **not using Supabase**. Instead we run our own **Postgres** (Docker locally, Railway Postgres in prod) and replace the bundled pieces:

- **Auth** → **Better Auth** with the Drizzle Postgres adapter; Google OAuth + email/password, sessions in Postgres. We own the `users` table (no `auth.users`). **Two-step Gmail consent:** login asks for basic Google scopes only; **`gmail.readonly`** (offline access) is requested later as a separate in-context "Connect Gmail to track replies" step via Better Auth's additional-scopes flow — so users aren't asked for inbox access at signup, which lifts conversion. Read-only, used only to follow up and track recruiter responses (FRD §6.3); refresh token stored encrypted for the worker to poll Gmail. Note: `gmail.readonly` is a Google *restricted* scope — production needs OAuth verification + CASA assessment (start early).
- **Storage** → **Cloudinary** (founder choice, 2026-06-17). CVs and tailored PDFs upload as `raw`/`auto` and are served via signed (authenticated) URLs since CV files are private (FRD §6.3). Hosted service — same in dev and prod, so no storage container is needed locally.
- **Edge Functions** → Next.js Route Handlers for webhooks (Paystack, WhatsApp, Gmail push) + a small Dockerized Node worker for the crawler / match scorer / email poller (node-cron or Railway cron).
- **Realtime** → not needed for MVP; the dashboard polls.
- **ORM/migrations** → Drizzle (Prisma is the acceptable alternative).

**Why:** the founder wants to avoid Supabase lock-in and keep the stack portable — plain Postgres + Docker runs anywhere (Railway now, anywhere later) and is easy to reason about for a solo dev. Local dev is one `docker-compose up` (Postgres; Cloudinary is hosted so needs no container). See `PLAN.md` §1 for the full architecture; the FRD's Supabase references are superseded.

## 2026-06-16 — Brand name: Sasa (not Mosi)

The FRD uses "Mosi" as a working name. We're shipping as **Sasa** (Swahili for "now"), matching the existing repo/domain (`usesasa`). Positioning emphasizes "apply *now*, the moment a role drops." Replace any remaining "Mosi" references with "Sasa".

## 2026-06-16 — Landing page localized to Africa, not cloned from Tsenta

The marketing site is modeled on Tsenta's structure (the US competitor) but localized to our market:
- **WhatsApp**, not iMessage, as the primary channel.
- **NGN pricing via Paystack** (credit packs), not USD subscriptions.
- **UK Skilled Worker / Canada Express Entry / EU Blue Card** sponsorship framing, not US OPT/H-1B.
- "japa" framing and African-professional persona.

The site was bootstrapped from a v0 "developer platform" template ("Optimus"). All sections were repurposed in place — structure/animations preserved, copy and data rewritten — rather than rebuilt, to move fast. Section mapping:

| Template section | Repurposed to |
|------------------|---------------|
| Hero | "Be the first to apply to every job that fits you. Hands off." |
| Features | The 4 capabilities: find, tailor, apply, track |
| How it works | The pipeline (watch → tailor → apply → track) as a live scan feed |
| Infrastructure | Discovery coverage (sources watched, poll cadence, target regions) |
| Metrics | Product results (applications, replies, interviews, time saved) |
| Integrations | ATS sources + channels marquee |
| Security | "Trust beats autonomy" — read-only Gmail, never invents facts, you approve, delete anytime |
| Developers | Channels: WhatsApp / Web / Chrome |
| Testimonials | African professional testimonials + "where users got hired" |
| Pricing | NGN credit packs (Starter/Growth/Hunter) + free trial, NGN/USD toggle |
| Footer | Sasa footer |

> Pricing on the landing page uses the FRD §5.7.2 credit packs (₦5k/15k/35k). The "monthly/annual" toggle from the template was repurposed to an NGN/USD currency toggle, since Sasa is credit-priced, not subscription-priced.
