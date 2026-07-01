# Deploying Sasa on Railway

Sasa is **two processes that share one Postgres**:

| Piece | What it is | Start command |
| --- | --- | --- |
| **web** | The Next.js app (pages, API routes, webhooks, auth) | `pnpm start` |
| **worker** | Long lived background process: pg-boss job handlers, the 8 hour discovery cron, interview reminders, Telegram polling | `pnpm worker:start` |
| **Postgres** | The database. Also the job queue (pg-boss stores jobs in Postgres) | Railway plugin |

A single Railway service runs ONE start command, so the web and the worker are **two
services in the same project, both deploying from this repo**. After the one time setup
below, every `git push` redeploys both.

The worker cannot run on a serverless host (it has infinite loops). Railway runs it as a
normal always on service, which is why we use Railway and not Vercel for the worker.

## One time setup

1. **Create a Railway project** and add the **Postgres** plugin. It exposes `DATABASE_URL`.

2. **Add the `web` service** from this GitHub repo:
   - Settings -> Config as Code -> path: `railway.web.json`
   - (That file sets build = `pnpm install && pnpm build`, start = `pnpm start`, and runs
     `pnpm db:migrate` as the pre deploy command so the prod DB is migrated on every deploy.)

3. **Add the `worker` service** from the **same repo**:
   - Settings -> Config as Code -> path: `railway.worker.json`
   - Keep **replicas = 1** (Telegram polling and the cron must be single instance).

4. **Set environment variables** (see list below). Use Railway **shared variables** at the
   project level so both services get them. Reference Postgres with `${{Postgres.DATABASE_URL}}`.

5. **Add your domain** (`usesasa.xyz`) to the `web` service and point DNS at Railway.

6. **Repoint webhooks / OAuth** to the live web URL (no more ngrok):
   - Paystack dashboard -> webhook URL: `https://usesasa.xyz/api/paystack/webhook`
   - Cal.com -> webhook URL: `https://usesasa.xyz/api/cal/webhook`
   - Google Cloud console -> OAuth authorized redirect URI for the prod domain.

After this, `git push` to the deploy branch redeploys **both** services automatically.

## Required environment variables (both services)

```
DATABASE_URL=${{Postgres.DATABASE_URL}}
BETTER_AUTH_SECRET=
BETTER_AUTH_URL=https://usesasa.xyz
NEXT_PUBLIC_SITE_URL=https://usesasa.xyz
SITE_URL=https://usesasa.xyz
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
ANTHROPIC_API_KEY=
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
PAYSTACK_SECRET_KEY=
PAYSTACK_PLAN_STARTER=
PAYSTACK_PLAN_PRO=
PAYSTACK_PLAN_POWER=
STEEL_API_KEY=
TELEGRAM_BOT_TOKEN=
RESEND_API_KEY=
EMAIL_FROM=
CAL_WEBHOOK_SECRET=
NEXT_PUBLIC_CAL_LINK=
NEXT_PUBLIC_CAL_ORIGIN=
ADMIN_EMAILS=
# optional: DISCOVERY_CRON (default "0 */8 * * *"), MYJOBMAG_*/JOBBERMAN_*/THEHUB_* page caps
```

The worker reads the same `process.env`; it only loads `.env.local` locally (a no op in prod).

## Notes / gotchas

- **One worker only.** Do not scale the worker past 1 replica.
- **Migrations** run automatically via the web service `preDeployCommand` (`pnpm db:migrate`).
  To run manually: `railway run --service web pnpm db:migrate`.
- **Browser for submission:** prod submits via **Steel** (remote browser), so the worker box
  needs no local Chromium. `postinstall` still runs `playwright install chromium || true`; it
  is harmless but you can drop it from the worker build later to slim the image.
- **Logs** are per service in Railway: web shows requests, worker shows `[worker] ...` lines
  and `[telegram] polling as @...`.
