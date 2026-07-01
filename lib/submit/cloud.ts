import { chromium, type Browser } from "playwright";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { applications } from "@/lib/db/schema";
import { getBalance, chargeForSubmission } from "@/lib/credits";
import { isSubscriber } from "@/lib/subscription";
import { notifySubmitted, notifySubmissionBlocked } from "@/lib/telegram";
import { buildSubmitContext, type Ats } from "./input";
import { nativeFillAndSubmit } from "./native-fill";

type SubmitResult = "submitted" | "needs_user" | "failed";

// Per-ATS submit button config — what the cloud filler clicks to submit.
const SUBMIT_CONFIG: Record<Ats, { selectors: string[] }> = {
  greenhouse: { selectors: ["#submit_app", "button#submit_app", 'button[type="submit"]', 'input[type="submit"]'] },
  lever: { selectors: [".template-btn-submit", "#btn-submit", 'button[type="submit"]'] },
  ashby: { selectors: ['button[type="submit"]', "button.ashby-application-form-submit-button"] },
  smartrecruiters: { selectors: ['button[type="submit"]', "button.js-form-submit"] },
  workday: { selectors: ['button[type="submit"]'] },
  workable: { selectors: ['button[data-ui="submit-application"]', 'button[type="submit"]'] },
  teamtailor: { selectors: ['button[type="submit"]', 'button:has-text("Submit application")'] },
  recruitee: { selectors: ['button[type="submit"]', 'button:has-text("Apply")'] },
  bamboohr: { selectors: ['button[type="submit"]', "#submitButton", 'button:has-text("Submit")'] },
  breezy: { selectors: ['button[type="submit"]', 'button:has-text("Apply")', 'button:has-text("Submit")'] },
  personio: { selectors: ['button[type="submit"]', "#submit-application", 'button:has-text("Send application")'] },
  gem: { selectors: ['button[type="submit"]', 'button:has-text("Submit application")', 'button:has-text("Apply")'] },
  custom: { selectors: ['button[type="submit"]', 'input[type="submit"]', 'button:has-text("Apply")', 'button:has-text("Submit")'] },
};

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

// Run the native filler against the live apply page in a real (headed-under-xvfb on
// the server) browser. Trusted events commit to React state and survive re-renders.
export async function runCloudSubmission(applicationId: string): Promise<{ result: SubmitResult; reason?: string }> {
  const ctx = await buildSubmitContext(applicationId);
  if (!ctx) return { result: "failed", reason: "could not assemble the application" };
  if (!ctx.applyUrl) return { result: "failed", reason: "no apply URL for this job" };

  const config = SUBMIT_CONFIG[ctx.ats];
  if (!config) return { result: "needs_user", reason: `the ${ctx.ats} ATS is not supported by cloud submit yet` };

  const dryRun = process.env.SUBMIT_DRY_RUN === "1";

  let browser: Browser | null = null;
  try {
    browser = await chromium.launch({
      // react-select widgets only commit with a real render, so default to headed
      // (server runs this under xvfb). Set SUBMIT_HEADLESS=1 to force headless.
      headless: process.env.SUBMIT_HEADLESS === "1",
      args: ["--disable-blink-features=AutomationControlled", "--no-sandbox"],
    });
    const context = await browser.newContext({ userAgent: UA, viewport: { width: 1280, height: 1800 }, locale: "en-US" });
    // tsx transpiles our in-page discovery fn with keepNames, emitting __name()
    // wrappers that get shipped to the page; define a shim so they resolve.
    await context.addInitScript(() => {
      (window as unknown as { __name: (fn: unknown) => unknown }).__name = (fn) => fn;
    });
    const page = await context.newPage();
    page.setDefaultTimeout(45000);

    console.log(`[cloud] app ${applicationId}: loading ${ctx.applyUrl}`);
    await page.goto(ctx.applyUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(3000); // let SPA forms (Ashby/Greenhouse) render

    const result = await nativeFillAndSubmit(page, ctx, { submitSelectors: config.selectors, submitTextSource: "submit|apply", dryRun });

    console.log(`[cloud] app ${applicationId}: result=${result.result}${result.reason ? ` (${result.reason})` : ""}`);
    return result;
  } catch (err) {
    console.error(`[cloud] app ${applicationId} error:`, err);
    return { result: "failed", reason: `cloud submit error: ${String(err).slice(0, 200)}` };
  } finally {
    await browser?.close().catch(() => {});
  }
}

// Full pipeline: run the submission, then apply the same side-effects the
// extension report route does (charge, state, Telegram).
export async function processSubmission(applicationId: string): Promise<void> {
  const app = await db.query.applications.findFirst({ where: eq(applications.id, applicationId) });
  if (!app) {
    console.warn(`[cloud] processSubmission: app ${applicationId} not found`);
    return;
  }
  if (app.state === "submitted") {
    console.log(`[cloud] app ${applicationId} already submitted, skipping`);
    return;
  }

  await db.update(applications).set({ state: "sending" }).where(eq(applications.id, applicationId));
  const { result, reason } = await runCloudSubmission(applicationId);

  if (result === "submitted") {
    const subscriber = await isSubscriber(app.userId);
    const balanceAfter = subscriber ? await getBalance(app.userId) : (await chargeForSubmission(app.userId, applicationId)) ?? 0;
    await db
      .update(applications)
      .set({ state: "submitted", submittedAt: new Date(), submittedVia: "cloud", creditsCharged: subscriber ? 0 : 1, pipelineStatus: "applied", pipelineUpdatedAt: new Date(), submissionNote: null })
      .where(eq(applications.id, applicationId));
    console.log(`[cloud] app ${applicationId} SUBMITTED (${subscriber ? "subscription" : "credit"})`);
    await notifySubmitted(applicationId, balanceAfter);
    return;
  }

  const note = reason?.slice(0, 300) ?? (result === "failed" ? "the submission failed" : "a field needs your input");
  await db.update(applications).set({ state: result, submissionNote: note }).where(eq(applications.id, applicationId));
  await notifySubmissionBlocked(applicationId, result as "needs_user" | "failed", note);
}
