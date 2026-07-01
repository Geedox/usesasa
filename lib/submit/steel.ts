import Steel from "steel-sdk";
import { chromium, type Browser } from "playwright";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { applications } from "@/lib/db/schema";
import { getBalance, chargeForSubmission } from "@/lib/credits";
import { isSubscriber, getEntitlement } from "@/lib/subscription";
import { notifySubmitted, notifySubmissionBlocked } from "@/lib/telegram";
import { enqueueAutoGrabCode } from "@/lib/queue";
import { buildSubmitContext, type Ats } from "./input";
import { nativeFillAndSubmit } from "./native-fill";

type SubmitResult = "submitted" | "needs_user" | "failed";
export type SteelResult = { result: SubmitResult; reason?: string; viewerUrl?: string; sessionId?: string; awaitingCode?: boolean };

export type SubmitStep = { label: string; at: number; status: "active" | "done" | "error" };

// Append a progress step to the application's submissionLog (marking the prior
// step done), so the dashboard can stream the agent's progress live.
export async function pushStep(applicationId: string, label: string, status: "active" | "done" | "error" = "active"): Promise<void> {
  try {
    const app = await db.query.applications.findFirst({ where: eq(applications.id, applicationId) });
    const log = ((app?.submissionLog as SubmitStep[] | null) ?? []).map((s) => (s.status === "active" ? { ...s, status: "done" as const } : s));
    log.push({ label, at: Date.now(), status });
    await db.update(applications).set({ submissionLog: log.slice(-12) }).where(eq(applications.id, applicationId));
  } catch { /* progress is best-effort */ }
}

const SUBMIT_SELECTORS: Record<Ats, string[]> = {
  greenhouse: ["#submit_app", "button#submit_app", 'button[type="submit"]', 'input[type="submit"]'],
  lever: [".template-btn-submit", "#btn-submit", 'button[type="submit"]'],
  ashby: ['button[type="submit"]', "button.ashby-application-form-submit-button"],
  smartrecruiters: ['button[type="submit"]', "button.js-form-submit"],
  workday: ['button[type="submit"]'],
  workable: ['button[data-ui="submit-application"]', 'button[type="submit"]'],
  teamtailor: ['button[type="submit"]', 'button:has-text("Submit application")'],
  recruitee: ['button[type="submit"]', 'button:has-text("Apply")'],
  bamboohr: ['button[type="submit"]', "#submitButton", 'button:has-text("Submit")'],
  breezy: ['button[type="submit"]', 'button:has-text("Apply")', 'button:has-text("Submit")'],
  personio: ['button[type="submit"]', "#submit-application", 'button:has-text("Send application")'],
  gem: ['button[type="submit"]', 'button:has-text("Submit application")', 'button:has-text("Apply")'],
  custom: ['button[type="submit"]', 'input[type="submit"]', 'button:has-text("Apply")', 'button:has-text("Submit")'],
};

// Submit an application in a Steel cloud browser. Steel runs a real headful Chrome
// (react-selects commit), solves CAPTCHAs, and gives a live-view URL the user can
// watch and TAKE OVER in — so anything the agent can't finish, the user completes
// inside the same browser we're observing, and it still counts.
export async function runSteelSubmission(
  applicationId: string,
  opts: { dryRun?: boolean } = {},
): Promise<SteelResult> {
  const apiKey = process.env.STEEL_API_KEY;
  if (!apiKey) return { result: "failed", reason: "STEEL_API_KEY not set" };

  const ctx = await buildSubmitContext(applicationId);
  if (!ctx) return { result: "failed", reason: "could not assemble the application" };
  if (!ctx.applyUrl) return { result: "failed", reason: "no apply URL for this job" };
  const selectors = SUBMIT_SELECTORS[ctx.ats];
  if (!selectors) return { result: "needs_user", reason: `the ${ctx.ats} ATS is not supported yet` };

  const client = new Steel({ steelAPIKey: apiKey });
  let session: { id: string; websocketUrl: string; sessionViewerUrl?: string; debugUrl?: string } | null = null;
  let browser: Browser | null = null;
  let keepAlive = false;
  try {
    // solveCaptcha + proxy are paid-plan features. Opt in with STEEL_PAID=1 once
    // upgraded; otherwise create a basic session and let the user solve any captcha
    // in the live view (which still counts, since we observe that browser).
    const paid = process.env.STEEL_PAID === "1";
    // 15 min so a slow fill (LLM answers + captcha solve) never outlives the
    // session, and so the session stays open for the user to finish a paused one.
    const timeout = 900000;
    const createOpts = paid ? { solveCaptcha: true, useProxy: true, blockAds: true, timeout } : { blockAds: true, timeout };
    let created;
    try {
      created = await client.sessions.create(createOpts);
    } catch (e) {
      // Plan rejected an option — fall back to the most basic session.
      console.warn(`[steel] session opts rejected (${String(e).slice(0, 80)}); retrying basic`);
      created = await client.sessions.create({ timeout });
    }
    session = created as unknown as { id: string; websocketUrl: string; sessionViewerUrl?: string; debugUrl?: string };
    // debugUrl (/player) is the embeddable live viewer; sessionViewerUrl is the dashboard.
    const viewerUrl = session.debugUrl ?? session.sessionViewerUrl;
    console.log(`[steel] app ${applicationId}: session ${session.id} — live view: ${viewerUrl}`);

    browser = await chromium.connectOverCDP(`${session.websocketUrl}&apiKey=${apiKey}`);
    const context = browser.contexts()[0] ?? (await browser.newContext());
    // The discovery fn is tsx-transpiled with keepNames; define the __name shim.
    await context.addInitScript(() => {
      (window as unknown as { __name: (fn: unknown) => unknown }).__name = (fn) => fn;
    });
    const page = context.pages()[0] ?? (await context.newPage());
    page.setDefaultTimeout(45000);

    console.log(`[steel] app ${applicationId}: loading ${ctx.applyUrl}`);
    await page.goto(ctx.applyUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(3000);

    const result = await nativeFillAndSubmit(page, ctx, {
      submitSelectors: selectors,
      submitTextSource: "submit|apply",
      dryRun: !!opts.dryRun,
      onStep: (label) => pushStep(applicationId, label),
    });

    console.log(`[steel] app ${applicationId}: result=${result.result}${result.reason ? ` (${result.reason})` : ""}`);
    // Keep the session ALIVE when we pause for the user (needs_user) so the live
    // view stays watchable and we can resume (e.g. type the email code) into the
    // same browser. It auto-expires at the timeout; resume releases it explicitly.
    keepAlive = result.result === "needs_user";
    return { ...result, viewerUrl, sessionId: session!.id };
  } catch (err) {
    console.error(`[steel] app ${applicationId} error:`, err);
    return { result: "failed", reason: `steel error: ${String(err).slice(0, 200)}`, sessionId: session?.id };
  } finally {
    await browser?.close().catch(() => {}); // disconnect Playwright (does not kill the Steel session)
    if (session?.id && !keepAlive) await client.sessions.release(session.id).catch(() => {});
  }
}

// Full pipeline: run the Steel submission, then apply side-effects (charge, state,
// Telegram) and persist the live-view URL so the dashboard can show it.
export async function processSteelSubmission(applicationId: string): Promise<void> {
  const app = await db.query.applications.findFirst({ where: eq(applications.id, applicationId) });
  if (!app) return;
  if (app.state === "submitted") return;

  // Gate before opening the browser. Subscribers are metered by allowance; credits
  // users pay 1 credit per submission.
  const subscriber = await isSubscriber(app.userId);
  if (subscriber) {
    if ((await getEntitlement(app.userId)).remaining <= 0) {
      const note = "You have reached your plan's application limit for this cycle. Upgrade or wait for the reset.";
      await db.update(applications).set({ state: "needs_user", submissionNote: note }).where(eq(applications.id, applicationId));
      await notifySubmissionBlocked(applicationId, "needs_user", note);
      return;
    }
  } else if ((await getBalance(app.userId)) < 1) {
    const note = "You are out of credits to submit. Top up and this application will go out.";
    await db.update(applications).set({ state: "needs_user", submissionNote: note }).where(eq(applications.id, applicationId));
    await notifySubmissionBlocked(applicationId, "needs_user", note);
    return;
  }

  await db.update(applications).set({ state: "sending", awaitingCode: false, submissionLog: [{ label: "Starting the cloud browser", at: Date.now(), status: "active" }] }).where(eq(applications.id, applicationId));
  const { result, reason, viewerUrl, sessionId, awaitingCode } = await runSteelSubmission(applicationId);
  await pushStep(applicationId, result === "submitted" ? "Application submitted" : awaitingCode ? "Waiting for your verification code" : "Paused — needs you", result === "submitted" ? "done" : result === "failed" ? "error" : "active");

  // Always persist the live-view URL + session so the dashboard can embed it.
  await db
    .update(applications)
    .set({ submissionViewUrl: viewerUrl ?? null, submissionSessionId: sessionId ?? null })
    .where(eq(applications.id, applicationId));

  if (result === "submitted") {
    const balanceAfter = subscriber ? await getBalance(app.userId) : (await chargeForSubmission(app.userId, applicationId)) ?? 0;
    await db
      .update(applications)
      .set({ state: "submitted", submittedAt: new Date(), submittedVia: "cloud", creditsCharged: subscriber ? 0 : 1, pipelineStatus: "applied", pipelineUpdatedAt: new Date(), submissionNote: null })
      .where(eq(applications.id, applicationId));
    await notifySubmitted(applicationId, balanceAfter);
    return;
  }

  const note = reason?.slice(0, 300) ?? (result === "failed" ? "the submission failed" : "needs your input");
  await db.update(applications).set({ state: result, submissionNote: note, awaitingCode: !!awaitingCode }).where(eq(applications.id, applicationId));
  await notifySubmissionBlocked(applicationId, result as "needs_user" | "failed", note);

  // If we are waiting on an emailed code and the user has Gmail connected, try to
  // grab it automatically and resume — falling back to manual entry if not found.
  if (awaitingCode) await enqueueAutoGrabCode({ applicationId, attempt: 0 }).catch(() => null);
}

// Resume a paused application by entering the verification code the user gave us.
// Reconnects to the still-alive Steel session, types the code, submits, confirms.
export async function resumeWithCode(applicationId: string, code: string): Promise<SteelResult> {
  const apiKey = process.env.STEEL_API_KEY;
  if (!apiKey) return { result: "failed", reason: "STEEL_API_KEY not set" };
  const app = await db.query.applications.findFirst({ where: eq(applications.id, applicationId) });
  if (!app?.submissionSessionId) return { result: "failed", reason: "this submission has no live session to resume" };

  const { enterCodeAndSubmit } = await import("./native-fill");
  const { jobs } = await import("@/lib/db/schema");
  const job = await db.query.jobs.findFirst({ where: eq(jobs.id, app.jobId) });
  const selectors = SUBMIT_SELECTORS[(job?.source as Ats) ?? "greenhouse"] ?? ['button[type="submit"]'];

  const client = new Steel({ steelAPIKey: apiKey });
  let browser: Browser | null = null;
  try {
    browser = await chromium.connectOverCDP(`wss://connect.steel.dev?sessionId=${app.submissionSessionId}&apiKey=${apiKey}`);
    const context = browser.contexts()[0];
    const page = context?.pages()[0];
    if (!page) return { result: "needs_user", reason: "the live session has expired; please re-approve to try again" };

    const result = await enterCodeAndSubmit(page, code.trim(), selectors);
    if (result.result === "submitted") {
      const subscriber = await isSubscriber(app.userId);
      const balanceAfter = subscriber ? await getBalance(app.userId) : (await chargeForSubmission(app.userId, applicationId)) ?? 0;
      await db.update(applications).set({ state: "submitted", submittedAt: new Date(), submittedVia: "cloud", creditsCharged: subscriber ? 0 : 1, pipelineStatus: "applied", pipelineUpdatedAt: new Date(), submissionNote: null, awaitingCode: false }).where(eq(applications.id, applicationId));
      await notifySubmitted(applicationId, balanceAfter);
      await client.sessions.release(app.submissionSessionId).catch(() => {});
    } else {
      await db.update(applications).set({ submissionNote: result.reason ?? "code did not complete it" }).where(eq(applications.id, applicationId));
    }
    return { ...result, sessionId: app.submissionSessionId };
  } catch (err) {
    return { result: "failed", reason: `resume error: ${String(err).slice(0, 160)}` };
  } finally {
    await browser?.close().catch(() => {});
  }
}
