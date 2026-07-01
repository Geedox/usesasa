import { config } from "dotenv";
config({ path: ".env.local" });
import { chromium } from "playwright";
import { getFillBundle } from "./bundle";

const APPLY_URL = process.argv[2] || "https://job-boards.greenhouse.io/vercel/jobs/5999792004";

async function main() {
  const bundle = await getFillBundle();
  console.log(`[proof] bundle built: ${(bundle.length / 1024).toFixed(0)} KB`);

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    viewport: { width: 1280, height: 1800 },
    locale: "en-US",
  });
  // tsx transpiles our evaluate() callbacks with keepNames, emitting __name()
  // wrappers that get shipped to the page. Define a shim so they resolve.
  await ctx.addInitScript(() => {
    (window as unknown as { __name: (fn: unknown) => unknown }).__name = (fn) => fn;
  });
  const page = await ctx.newPage();
  page.on("console", (m) => {
    const t = m.text();
    if (t.includes("[sasa]")) console.log("  page>", t);
  });

  console.log(`[proof] loading ${APPLY_URL}`);
  await page.goto(APPLY_URL, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(3500); // let the SPA render the form

  // What does the page look like before we touch it?
  const pre = await page.evaluate(() => {
    const inputs = Array.from(document.querySelectorAll("input,textarea,select")).filter(
      (e) => (e as HTMLInputElement).type !== "hidden",
    );
    const fileInputs = Array.from(document.querySelectorAll('input[type=file]')).length;
    const recaptchaFrames = Array.from(document.querySelectorAll("iframe")).filter((f) =>
      /recaptcha\/api2\/(anchor|bframe)/.test((f as HTMLIFrameElement).src),
    ).length;
    const sitekeyEl = document.querySelector("[data-sitekey]");
    const grecaptcha = typeof (window as unknown as { grecaptcha?: unknown }).grecaptcha !== "undefined";
    return {
      fields: inputs.length,
      fileInputs,
      recaptchaFrames,
      sitekey: sitekeyEl?.getAttribute("data-sitekey") ?? null,
      grecaptchaLoaded: grecaptcha,
      hasSubmit: !!document.querySelector("#submit_app,button[type=submit]"),
    };
  });
  console.log("[proof] pre-fill DOM:", JSON.stringify(pre));

  // Bridge: requestAnswers returns {} for the proof (we only test known-field fill).
  await page.exposeFunction("__sasaRequestAnswers", async () => ({}));

  await page.addScriptTag({ content: bundle });
  const hasFill = await page.evaluate(() => typeof window.__sasaFill === "function");
  console.log(`[proof] engine injected: ${hasFill}`);

  // Fill with dummy data. submitSelectors deliberately match NOTHING so it fills
  // but never actually submits a real application during this proof.
  const result = await page.evaluate(async () => {
    return window.__sasaFill(
      {
        fields: {
          firstName: "Test",
          lastName: "Candidate",
          email: "test.candidate@example.com",
          phone: "+2348139289312",
          linkedin: "https://www.linkedin.com/in/test-candidate",
          github: "https://github.com/testcandidate",
          portfolio: "",
        },
        coverLetter: "This is a proof-of-concept cover letter.",
        answers: {},
        resumeBase64: null,
        resumeName: "resume.pdf",
      },
      {
        submitSelectors: ["#__sasa_never_match__"],
        submitTextRe: /__sasa_never_match__/,
        requestAnswers: (q: unknown) => (window as unknown as { __sasaRequestAnswers: (q: unknown) => Promise<Record<string, string>> }).__sasaRequestAnswers(q),
      },
    );
  });
  console.log("[proof] fill result:", JSON.stringify(result));

  // What actually got filled + is captcha present after interaction?
  const post = await page.evaluate(() => {
    const vals: Record<string, string> = {};
    for (const el of Array.from(document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("input,textarea"))) {
      if (el.type === "hidden" || el.type === "file") continue;
      if (el.value) vals[el.getAttribute("name") || el.id || el.getAttribute("aria-label") || "?"] = el.value.slice(0, 40);
    }
    const recaptcha = Array.from(document.querySelectorAll("iframe")).filter((f) =>
      /recaptcha\/api2\/(anchor|bframe)|hcaptcha/.test((f as HTMLIFrameElement).src),
    ).map((f) => (f as HTMLIFrameElement).src.slice(0, 80));
    return { filledCount: Object.keys(vals).length, vals, recaptcha };
  });
  console.log("[proof] post-fill filled values:", JSON.stringify(post.vals, null, 2));
  console.log("[proof] post-fill captcha frames:", JSON.stringify(post.recaptcha));

  await browser.close();
  process.exit(0);
}

main().catch((e) => {
  console.error("[proof] error:", e);
  process.exit(1);
});
