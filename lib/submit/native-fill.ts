import type { Page } from "playwright";
import { classifyField, valueForRole, type FillData } from "../../extension/lib/greenhouse-map";
import type { SubmitContext } from "./input";
import { solveRecaptcha, solveHcaptcha, captchaEnabled } from "./captcha";

// Detect a reCAPTCHA/hCaptcha on the page, solve it via the captcha provider
// (2Captcha), and inject the token so the form treats the challenge as passed.
// Runs in Node, so we call the solver directly. Returns true if a token landed.
async function solveCaptchaIfPresent(page: Page, onStep?: (label: string) => Promise<void> | void): Promise<boolean> {
  if (!captchaEnabled()) return false;
  const info = (await page.evaluate(() => {
    const frames = Array.from(document.querySelectorAll("iframe")).map((f) => (f as HTMLIFrameElement).src);
    const hc = frames.find((s) => /hcaptcha\.com/.test(s));
    const rc = frames.find((s) => /recaptcha\/(api2|enterprise)\/(anchor|bframe)/.test(s));
    const dataKey = document.querySelector("[data-sitekey]")?.getAttribute("data-sitekey") ?? "";
    const fromFrame = (src?: string, param = "k") => {
      try { return src ? new URL(src).searchParams.get(param) ?? "" : ""; } catch { return ""; }
    };
    if (hc) {
      const sitekey = dataKey || fromFrame(hc, "sitekey");
      return sitekey ? { type: "hcaptcha", sitekey, enterprise: false } : null;
    }
    if (rc) {
      const sitekey = dataKey || fromFrame(rc, "k");
      const enterprise = /enterprise/.test(rc) || typeof (window as unknown as { grecaptcha?: { enterprise?: unknown } }).grecaptcha?.enterprise !== "undefined";
      return sitekey ? { type: "recaptcha", sitekey, enterprise } : null;
    }
    return null;
  })) as { type: string; sitekey: string; enterprise: boolean } | null;
  if (!info) return false;

  try { await onStep?.("Solving the captcha"); } catch { /* best-effort */ }
  console.log(`[native] solving ${info.type} (sitekey ${info.sitekey.slice(0, 10)}…) via 2Captcha`);
  const url = page.url();
  const token = info.type === "hcaptcha"
    ? await solveHcaptcha({ sitekey: info.sitekey, url })
    : await solveRecaptcha({ sitekey: info.sitekey, url, enterprise: info.enterprise });
  if (!token) {
    console.warn("[native] captcha solve failed");
    return false;
  }
  await page.evaluate((t) => {
    for (const ta of Array.from(document.querySelectorAll<HTMLTextAreaElement>('textarea[name="g-recaptcha-response"], textarea[id^="g-recaptcha-response"], textarea[name="h-captcha-response"]'))) {
      ta.value = t;
      ta.dispatchEvent(new Event("input", { bubbles: true }));
      ta.dispatchEvent(new Event("change", { bubbles: true }));
    }
    // Best-effort: fire the registered grecaptcha callback so invisible widgets proceed.
    try {
      const cfg = (window as unknown as { ___grecaptcha_cfg?: { clients?: Record<string, unknown> } }).___grecaptcha_cfg;
      const walk = (o: unknown) => {
        if (!o || typeof o !== "object") return;
        for (const v of Object.values(o as Record<string, unknown>)) {
          if (v && typeof v === "object" && "callback" in (v as object)) {
            const cb = (v as { callback?: unknown }).callback;
            if (typeof cb === "function") { try { (cb as (x: string) => void)(t); } catch { /* ignore */ } }
          } else if (v && typeof v === "object") walk(v);
        }
      };
      for (const c of Object.values(cfg?.clients ?? {})) walk(c);
    } catch { /* ignore */ }
  }, token);
  console.log("[native] captcha token injected");
  return true;
}

// Playwright-NATIVE form filler for the cloud path. Unlike the injected engine
// (which dispatches synthetic events the extension is limited to), this drives the
// real browser: trusted clicks and keystrokes that go through React's own handlers
// and COMMIT to form state, so they survive the SPA re-renders that wipe synthetic
// fills (the new Greenhouse react-select problem). Discovery reuses the engine's
// label logic (injected); every fill is a real interaction.

type Kind = "file" | "react-select" | "native-select" | "radio" | "checkbox" | "phone" | "text" | "textarea";
type FieldDesc = {
  sid: string; // data-sasa-id on the control element
  kind: Kind;
  name: string;
  elemId: string;
  label: string;
  placeholder: string;
  autocomplete: string;
  required: boolean;
  options: { sid: string; label: string }[]; // radio/checkbox option members (sid per option)
  optionTexts: string[]; // select/react-select option labels (for the answer model)
  autofillDropzone: boolean; // a "autofill from resume" file input we must skip
};

const DISCOVERY = `(${discoveryFn.toString()})()`;

// Runs IN the page. Tags every control with a data-sasa-id and returns descriptors.
// Self-contained (no closures) so it serializes cleanly into page.evaluate.
function discoveryFn(): unknown {
  const clean = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").replace(/[\s*]+$/, "").trim();
  const isVisible = (el: Element) => (el as HTMLElement).offsetParent !== null;
  const isRequired = (el: Element) =>
    (el as HTMLInputElement).required || el.getAttribute("aria-required") === "true" || !!el.closest("[aria-required=true], fieldset[aria-required=true]");
  const optionLabel = (el: Element): string => {
    const id = el.getAttribute("id");
    if (id) {
      const lab = document.querySelector(`label[for="${(window as unknown as { CSS: typeof CSS }).CSS.escape(id)}"]`);
      if (clean(lab?.textContent)) return clean(lab!.textContent);
    }
    const wrap = el.closest("label");
    if (clean(wrap?.textContent)) return clean(wrap!.textContent);
    return clean(el.getAttribute("aria-label")) || clean((el as HTMLInputElement).value);
  };
  const questionLabel = (el: Element): string => {
    const fs = el.closest("fieldset");
    const legend = fs?.querySelector("legend");
    if (clean(legend?.textContent)) return clean(legend!.textContent);
    for (const sel of ["[role=group]", "[aria-labelledby]", "[aria-label]"]) {
      const g = el.closest(sel) as HTMLElement | null;
      if (!g) continue;
      if (clean(g.getAttribute("aria-label"))) return clean(g.getAttribute("aria-label"));
      const lb = g.getAttribute("aria-labelledby");
      if (lb) {
        const t = clean(lb.split(/\s+/).map((i) => document.getElementById(i)?.textContent ?? "").join(" "));
        if (t) return t;
      }
    }
    let node: HTMLElement | null = el.parentElement;
    for (let i = 0; i < 5 && node; i++, node = node.parentElement) {
      const lbl = node.querySelector("label, legend");
      if (lbl && !lbl.contains(el) && clean(lbl.textContent)) return clean(lbl.textContent);
    }
    return optionLabel(el);
  };
  const standalone = (el: Element) => optionLabel(el) || questionLabel(el);

  let n = 0;
  const tag = (el: Element) => {
    let sid = el.getAttribute("data-sasa-id");
    if (!sid) { sid = "sasa-" + n++; el.setAttribute("data-sasa-id", sid); }
    return sid;
  };
  const fields: FieldDesc[] = [];
  const handled = new Set<Element>();

  // 1) File inputs (résumé). Keep even when visually hidden behind a dropzone.
  for (const el of Array.from(document.querySelectorAll<HTMLInputElement>('input[type="file"]'))) {
    const ctx = (optionLabel(el) + " " + (el.closest("div,fieldset,section,label")?.textContent ?? "")).replace(/\s+/g, " ").slice(0, 200).toLowerCase();
    fields.push({ sid: tag(el), kind: "file", name: el.getAttribute("name") ?? "", elemId: el.id, label: standalone(el) || "Resume", placeholder: "", autocomplete: "", required: isRequired(el), options: [], optionTexts: [], autofillDropzone: /autofill/.test(ctx) });
    handled.add(el);
  }

  // 2) react-select controls (each control == one dropdown).
  for (const ctrl of Array.from(document.querySelectorAll<HTMLElement>('[class*="select__control"]'))) {
    if (!isVisible(ctrl)) continue;
    const inner = ctrl.querySelector("input");
    if (inner) handled.add(inner);
    handled.add(ctrl);
    // Phone country pickers sit next to a tel input; skip them as fields.
    fields.push({ sid: tag(ctrl), kind: "react-select", name: inner?.getAttribute("name") ?? "", elemId: inner?.id ?? "", label: standalone(ctrl), placeholder: clean(ctrl.querySelector('[class*="placeholder"]')?.textContent), autocomplete: "", required: isRequired(ctrl) || isRequired(inner ?? ctrl), options: [], optionTexts: [] , autofillDropzone: false });
  }

  // 3) native selects.
  for (const el of Array.from(document.querySelectorAll<HTMLSelectElement>("select"))) {
    if (handled.has(el) || !isVisible(el)) continue;
    handled.add(el);
    const opts = Array.from(el.options).map((o) => clean(o.text)).filter((t) => t && !/^(select|choose|\.\.\.)/i.test(t));
    fields.push({ sid: tag(el), kind: "native-select", name: el.getAttribute("name") ?? "", elemId: el.id, label: standalone(el), placeholder: "", autocomplete: "", required: isRequired(el), options: [], optionTexts: opts, autofillDropzone: false });
  }

  // 4) radio groups by name.
  const radioNames = new Set<string>();
  for (const el of Array.from(document.querySelectorAll<HTMLInputElement>('input[type="radio"]'))) {
    if (handled.has(el) || !el.name || radioNames.has(el.name) || !isVisible(el)) continue;
    radioNames.add(el.name);
    const group = Array.from(document.querySelectorAll<HTMLInputElement>(`input[type=radio][name="${(window as unknown as { CSS: typeof CSS }).CSS.escape(el.name)}"]`));
    group.forEach((g) => handled.add(g));
    fields.push({ sid: tag(el), kind: "radio", name: el.name, elemId: el.id, label: questionLabel(el), placeholder: "", autocomplete: "", required: group.some(isRequired), options: group.map((g) => ({ sid: tag(g), label: optionLabel(g) })).filter((o) => o.label), optionTexts: group.map(optionLabel).filter(Boolean), autofillDropzone: false });
  }

  // 5) checkboxes: group of 2+ == pick-one, lone == consent yes/no.
  const cbByName = new Map<string, HTMLInputElement[]>();
  const singles: HTMLInputElement[] = [];
  for (const el of Array.from(document.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'))) {
    if (handled.has(el) || !isVisible(el)) continue;
    if (el.name && document.querySelectorAll(`input[type=checkbox][name="${(window as unknown as { CSS: typeof CSS }).CSS.escape(el.name)}"]`).length > 1) {
      cbByName.set(el.name, [...(cbByName.get(el.name) ?? []), el]);
    } else singles.push(el);
  }
  for (const [name, group] of cbByName) {
    group.forEach((g) => handled.add(g));
    fields.push({ sid: tag(group[0]), kind: "radio", name, elemId: group[0].id, label: questionLabel(group[0]), placeholder: "", autocomplete: "", required: group.some(isRequired), options: group.map((g) => ({ sid: tag(g), label: optionLabel(g) })).filter((o) => o.label), optionTexts: group.map(optionLabel).filter(Boolean), autofillDropzone: false });
  }
  for (const cb of singles) {
    handled.add(cb);
    fields.push({ sid: tag(cb), kind: "checkbox", name: cb.getAttribute("name") ?? "", elemId: cb.id, label: standalone(cb), placeholder: "", autocomplete: "", required: isRequired(cb), options: [], optionTexts: [], autofillDropzone: false });
  }

  // 6) text / tel / email / textarea not already part of a widget.
  for (const el of Array.from(document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("input, textarea"))) {
    if (handled.has(el) || !isVisible(el)) continue;
    const t = (el as HTMLInputElement).type;
    if (["hidden", "file", "radio", "checkbox", "submit", "button"].includes(t)) continue;
    if (el.getAttribute("aria-hidden") === "true" || el.getAttribute("tabindex") === "-1") continue;
    const isTextarea = el instanceof HTMLTextAreaElement;
    const kind: Kind = t === "tel" ? "phone" : isTextarea ? "textarea" : "text";
    fields.push({ sid: tag(el), kind, name: el.getAttribute("name") ?? "", elemId: el.id, label: standalone(el), placeholder: (el as HTMLInputElement).placeholder ?? "", autocomplete: el.getAttribute("autocomplete") ?? "", required: isRequired(el), options: [], optionTexts: [], autofillDropzone: false });
  }

  return fields;
}

const sel = (sid: string) => `[data-sasa-id="${sid}"]`;
const rx = (s: string) => new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").slice(0, 40), "i");

// Does the react-select control show a committed value?
async function reactSelectFilled(page: Page, sid: string): Promise<boolean> {
  return page.evaluate((s) => {
    const ctrl = document.querySelector(`[data-sasa-id="${s}"]`);
    const sv = ctrl?.querySelector('[class*="single-value"],[class*="singleValue"],[class*="multi-value"]');
    return !!(sv && (sv.textContent ?? "").replace(/\s+/g, " ").trim());
  }, sid);
}

// Fill one react-select via real interactions. The reliable way to drive
// react-select is to focus it, type to filter, and press Enter (it highlights the
// first match) — trusted events that commit to React and survive re-renders. We
// verify the value landed and fall back to clicking the option by text.
async function fillReactSelect(page: Page, sid: string, value: string): Promise<void> {
  const control = page.locator(sel(sid));
  const optionSel = '[class*="select__option"],[class*="-option"],[role="option"]';
  for (let attempt = 0; attempt < 2; attempt++) {
    await control.scrollIntoViewIfNeeded().catch(() => {});
    await control.click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(300);
    await page.keyboard.type(value.slice(0, 30), { delay: 20 });
    await page.waitForTimeout(550);
    // Prefer Enter (selects the highlighted first match).
    await page.keyboard.press("Enter").catch(() => {});
    await page.waitForTimeout(250);
    if (await reactSelectFilled(page, sid)) return;
    // Fallback: open and click the matching option by text.
    await control.click({ timeout: 4000 }).catch(() => {});
    await page.waitForTimeout(300);
    const opt = page.locator(optionSel).filter({ hasText: rx(value) }).first();
    if (await opt.count()) await opt.click({ timeout: 4000 }).catch(() => {});
    await page.keyboard.press("Escape").catch(() => {});
    if (await reactSelectFilled(page, sid)) return;
  }
}

async function fillNativeSelect(page: Page, sid: string, value: string): Promise<void> {
  const loc = page.locator(sel(sid));
  try {
    await loc.selectOption({ label: value }, { timeout: 3000 });
    return;
  } catch { /* try a looser match */ }
  const texts = await loc.locator("option").allTextContents();
  const match = texts.find((t) => t.trim().toLowerCase() === value.toLowerCase()) ?? texts.find((t) => t.trim().toLowerCase().includes(value.toLowerCase()));
  if (match) await loc.selectOption({ label: match }).catch(() => {});
}

// A location/autocomplete text input: type, then click the matching suggestion.
async function fillAutocomplete(page: Page, sid: string, value: string): Promise<void> {
  const loc = page.locator(sel(sid));
  await loc.scrollIntoViewIfNeeded().catch(() => {});
  await loc.click().catch(() => {});
  await loc.fill("");
  await loc.pressSequentially(value.slice(0, 40), { delay: 25 });
  await page.waitForTimeout(900);
  const sug = page.locator('[class*="option"],[role="option"],[class*="suggestion"],[class*="menu"] li,[class*="results"] li').filter({ hasText: rx(value.split(",")[0]) }).first();
  if (await sug.count()) await sug.click({ timeout: 3000 }).catch(() => {});
}

type FillResult = { result: "submitted" | "needs_user" | "failed"; reason?: string; awaitingCode?: boolean };

export async function nativeFillAndSubmit(page: Page, ctx: SubmitContext, opts: { submitSelectors: string[]; submitTextSource: string; dryRun: boolean; onStep?: (label: string) => Promise<void> | void }): Promise<FillResult> {
  const step = async (label: string) => { try { await opts.onStep?.(label); } catch { /* progress is best-effort */ } };
  await step("Opening the application page");
  await page.waitForSelector("input,textarea,select", { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1500);

  // Bot-check wall (Cloudflare "verify you are human", "just a moment"). Without the
  // paid proxy + captcha solver, the agent can't pass these — so pause with a clear
  // message and keep the session alive for the user to complete in the live browser.
  const isChallenge = await page.evaluate(() => {
    const t = (document.body?.innerText ?? "").toLowerCase();
    if (/verify you are human|performing security verification|just a moment|checking your browser|attention required|needs to review the security of your connection/.test(t)) return true;
    return !!document.querySelector('iframe[src*="challenges.cloudflare.com"], .cf-turnstile, #challenge-form, #cf-challenge-running');
  }).catch(() => false);
  if (isChallenge) {
    await step("The site is asking to verify you are human");
    return {
      result: "needs_user",
      reason: "This site is showing a 'verify you are human' check that blocks the agent. Open the live browser below, tick the box, then finish the application there — I'll confirm it once it's submitted.",
    };
  }

  // Attach the résumé first (real upload), skipping any autofill-from-resume dropzone.
  let resumeAttached = false;
  if (ctx.resumeBase64) {
    await step("Attaching your resume");
    const fileDescs = (await page.evaluate(DISCOVERY)) as FieldDesc[];
    for (const f of fileDescs.filter((d) => d.kind === "file" && !d.autofillDropzone)) {
      try {
        await page.setInputFiles(sel(f.sid), { name: ctx.resumeName, mimeType: "application/pdf", buffer: Buffer.from(ctx.resumeBase64, "base64") });
        resumeAttached = true;
      } catch { /* keep trying others */ }
    }
    await page.waitForTimeout(1500); // let any résumé parse settle before we fill
  }

  // The fill loop. The SPA renders fields progressively (Country after Location),
  // so we re-discover and fill until nothing new needs filling — a few passes.
  await step("Filling in your details");
  const answerCache: Record<string, string> = {};
  const labelAnswered = new Set<string>();
  let askedOnce = false;
  for (let pass = 0; pass < 4; pass++) {
    const descs = (await page.evaluate(DISCOVERY)) as FieldDesc[];

    // Resolve a value for every field still empty.
    const knownVals: { f: FieldDesc; value: string }[] = [];
    const questions: { id: string; label: string; type: string; options?: string[] }[] = [];
    const qById = new Map<string, FieldDesc>();
    for (const f of descs) {
      if (f.kind === "file") continue;
      const role = classifyField({ name: f.name, id: f.elemId, label: f.label, type: f.kind === "phone" ? "tel" : "text", placeholder: f.placeholder, autocomplete: f.autocomplete });
      if (role === "coverLetter") { knownVals.push({ f, value: ctx.coverLetter }); continue; }
      const known = role && role !== "resume" ? valueForRole(role, ctx.fields as unknown as FillData) : null;
      if (known) { knownVals.push({ f, value: known }); continue; }
      if (f.kind === "phone") { knownVals.push({ f, value: ctx.fields.phone }); continue; }
      // Otherwise it is a question for the model (dedup by label).
      const key = f.label.toLowerCase();
      if (labelAnswered.has(key) && answerCache[key]) { knownVals.push({ f, value: answerCache[key] }); continue; }
      const type = f.kind === "react-select" || f.kind === "native-select" ? "select" : f.kind === "radio" ? "radio" : f.kind === "checkbox" ? "checkbox" : f.kind === "textarea" ? "textarea" : "text";
      const id = `q_${f.sid}`;
      questions.push({ id, label: f.label || `field ${f.sid}`, type, options: (f.optionTexts.length ? f.optionTexts : f.options.map((o) => o.label)) || undefined });
      qById.set(id, f);
    }

    // Generate answers for the unmapped questions (reuses the shared generator with
    // the applicant's profile + work-eligibility context).
    if (questions.length) {
      if (!askedOnce) { await step(`Answering ${questions.length} application question${questions.length === 1 ? "" : "s"}`); askedOnce = true; }
      const answers = await ctx.requestAnswers(questions.map((q) => ({ id: q.id, label: q.label, type: q.type, options: q.options })));
      for (const q of questions) {
        const v = answers[q.id];
        const f = qById.get(q.id)!;
        if (v) { knownVals.push({ f, value: v }); answerCache[f.label.toLowerCase()] = v; labelAnswered.add(f.label.toLowerCase()); }
      }
    }

    // Fill everything with native interactions. Skip fields already filled so the
    // passes converge and we never re-type (and disturb) a committed value.
    let did = 0;
    for (const { f, value } of knownVals) {
      if (!value) continue;
      try {
        // Already-filled guard.
        if (f.kind === "react-select") { if (await reactSelectFilled(page, f.sid)) continue; }
        else if (f.kind === "native-select") { const v = await page.locator(sel(f.sid)).inputValue().catch(() => ""); if (v) continue; }
        else if (f.kind === "text" || f.kind === "textarea" || f.kind === "phone") { const v = await page.locator(sel(f.sid)).inputValue().catch(() => ""); if (v) continue; }
        else if (f.kind === "checkbox") { if (await page.locator(sel(f.sid)).isChecked().catch(() => false)) continue; }
        else if (f.kind === "radio") { const anyChecked = await page.evaluate((sids) => sids.some((s) => (document.querySelector(`[data-sasa-id="${s}"]`) as HTMLInputElement)?.checked), f.options.map((o) => o.sid)); if (anyChecked) continue; }

        if (f.kind === "text" || f.kind === "textarea") {
          // Location autocompletes need the suggestion click; plain text just fills.
          if (/location|city|address/i.test(f.label) && f.kind === "text") await fillAutocomplete(page, f.sid, value);
          else await page.locator(sel(f.sid)).fill(value, { timeout: 4000 });
        } else if (f.kind === "phone") {
          await page.locator(sel(f.sid)).fill(value, { timeout: 4000 });
        } else if (f.kind === "native-select") {
          await fillNativeSelect(page, f.sid, value);
        } else if (f.kind === "react-select") {
          await fillReactSelect(page, f.sid, value);
        } else if (f.kind === "checkbox") {
          const yes = /^(yes|true|1|i agree|agree|accept|acknowledge|confirm)/i.test(value);
          if (yes) await page.locator(sel(f.sid)).check({ timeout: 4000 }).catch(() => {});
        } else if (f.kind === "radio") {
          const opt = f.options.find((o) => o.label.toLowerCase() === value.toLowerCase()) ?? f.options.find((o) => o.label.toLowerCase().includes(value.toLowerCase()));
          if (opt) await page.locator(sel(opt.sid)).check({ timeout: 4000 }).catch(async () => { await page.locator(sel(opt.sid)).click({ timeout: 3000 }).catch(() => {}); });
        }
        did++;
      } catch { /* keep going; reassessed next pass */ }
      await page.waitForTimeout(120 + Math.floor(Math.random() * 200));
    }
    console.log(`[native] pass ${pass + 1}: filled ${did} field(s), ${questions.length} asked`);
    await page.waitForTimeout(700);
    if (did === 0 && pass > 0) break; // stable
  }

  // What required fields are still empty? (react-select value shows in the control's
  // single-value, not the input, so check that.)
  const stillEmpty = (await page.evaluate(() => {
    const clean = (s: string | null) => (s ?? "").replace(/\s+/g, " ").trim();
    const isReq = (el: Element) => (el as HTMLInputElement).required || el.getAttribute("aria-required") === "true" || !!el.closest("[aria-required=true]");
    const bad: string[] = [];
    const seen = new Set<string>();
    for (const ctrl of Array.from(document.querySelectorAll<HTMLElement>('[class*="select__control"]'))) {
      if (!isReq(ctrl) && !isReq(ctrl.querySelector("input") ?? ctrl)) continue;
      const sv = ctrl.querySelector('[class*="single-value"],[class*="singleValue"],[class*="multi-value"]');
      if (!clean(sv?.textContent ?? "")) bad.push(clean((ctrl.closest("[class*=field]")?.querySelector("label,legend")?.textContent) ?? "a dropdown"));
    }
    for (const el of Array.from(document.querySelectorAll<HTMLInputElement>("input,textarea,select"))) {
      if (el.type === "hidden" || el.type === "file" || el.type === "radio" || el.type === "checkbox") continue;
      if (el.getAttribute("aria-hidden") === "true" || el.getAttribute("tabindex") === "-1") continue;
      if (el.closest('[class*="select__control"]')) continue;
      if (!isReq(el) || el.value) continue;
      const key = el.getAttribute("name") || el.id || "?";
      if (seen.has(key)) continue; seen.add(key);
      bad.push(key);
    }
    return bad.slice(0, 8);
  })) as string[];

  if (stillEmpty.length) {
    return { result: "needs_user", reason: `${stillEmpty.length} required field(s) still need an answer: ${stillEmpty.join("; ")}` };
  }
  if (!resumeAttached && ctx.resumeBase64) return { result: "needs_user", reason: "I couldn't attach your resume automatically here. Open the live browser, upload it, and finish the application there — I'll confirm it once it's submitted." };
  if (opts.dryRun) return { result: "needs_user", reason: "dry run: filled, did not submit" };

  const isConfirmed = () =>
    page.evaluate(() => {
      const SUCCESS = /thank you|thanks for applying|application (has been )?(received|submitted|sent)|successfully (submitted|applied|sent)|we('| ?ha)?ve received your|your application (is|has been)/i;
      if (SUCCESS.test(document.body?.innerText ?? "")) return true;
      if (/\/(confirmation|thanks|thank-you|success)\b/.test(location.pathname)) return true;
      return !!document.querySelector('[class*="confirmation"],[data-testid*="success"],[data-testid*="confirmation"],[class*="postApply"]');
    });

  // It may have already submitted during fill (e.g. Enter on the last field
  // navigated to the confirmation page) — never call a real submit a failure.
  if (await isConfirmed()) return { result: "submitted" };

  // Submit (real click) and verify a genuine confirmation.
  await step("Submitting your application");
  const submitLoc = page.locator([...opts.submitSelectors, `button:has-text("Submit")`, `button:has-text("Apply")`].join(", ")).first();
  if (!(await submitLoc.count())) {
    if (await isConfirmed()) return { result: "submitted" };
    return { result: "needs_user", reason: "could not find the submit button" };
  }
  await submitLoc.scrollIntoViewIfNeeded().catch(() => {});
  await submitLoc.click({ timeout: 5000 }).catch(() => {});

  let solvedCaptcha = false;
  for (let i = 0; i < 14; i++) {
    await page.waitForTimeout(800);
    if (await isConfirmed()) return { result: "submitted" };
    // Not confirmed yet — a captcha may be blocking. Solve it once via 2Captcha,
    // then re-click submit.
    if (!solvedCaptcha && (await solveCaptchaIfPresent(page, step))) {
      solvedCaptcha = true;
      await page.waitForTimeout(500);
      await submitLoc.click({ timeout: 5000 }).catch(() => {});
    }
  }

  // Email verification code? Some ATSes email a code mid-apply that must be entered
  // to finish. We can't read the user's email, so PAUSE and ask them for the code.
  if (await detectCodePrompt(page)) {
    return { result: "needs_user", awaitingCode: true, reason: "This employer emailed you a verification code to finish the application. Reply with the code and I will enter it and submit." };
  }

  return {
    result: "needs_user",
    reason: solvedCaptcha
      ? "submitted with a solved captcha but could not confirm — open the live view to finish"
      : "clicked submit but could not confirm; finish it in the live view",
  };
}

// Does the page look like it is asking for an emailed verification code?
async function detectCodePrompt(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const t = (document.body?.innerText ?? "").toLowerCase();
    const asksCode = /(verification|confirmation|one[- ]?time|security|access)\s*code|enter the code|code (we )?(sent|emailed)|check your email|sent (you )?a code/.test(t);
    if (!asksCode) return false;
    // ...and there is a visible empty input to type it into.
    const inputs = Array.from(document.querySelectorAll<HTMLInputElement>('input[type=text],input[type=number],input[type=tel],input[autocomplete="one-time-code"],input[inputmode="numeric"]'));
    return inputs.some((el) => el.offsetParent !== null && !el.value && el.type !== "hidden");
  });
}

// Resume a paused submission: reconnect to the live page, type the code the user
// gave into the code field, submit, and verify. Used by the code endpoint.
export async function enterCodeAndSubmit(page: Page, code: string, submitSelectors: string[]): Promise<FillResult> {
  const typed = await page.evaluate((c) => {
    const inputs = Array.from(document.querySelectorAll<HTMLInputElement>('input[type=text],input[type=number],input[type=tel],input[autocomplete="one-time-code"],input[inputmode="numeric"]'))
      .filter((el) => el.offsetParent !== null && !el.value && el.type !== "hidden");
    if (!inputs.length) return false;
    const setNative = (el: HTMLInputElement, v: string) => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setter?.call(el, v);
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    };
    // Some forms split the code across one-box-per-digit inputs.
    if (inputs.length >= c.length && inputs.length <= c.length + 2) {
      c.split("").forEach((d, i) => inputs[i] && setNative(inputs[i], d));
    } else {
      setNative(inputs[0], c);
    }
    return true;
  }, code);
  if (!typed) return { result: "needs_user", reason: "could not find the code field on the page" };

  await page.waitForTimeout(400);
  const submitLoc = page.locator([...submitSelectors, `button:has-text("Submit")`, `button:has-text("Verify")`, `button:has-text("Continue")`, `button:has-text("Confirm")`].join(", ")).first();
  if (await submitLoc.count()) await submitLoc.click({ timeout: 5000 }).catch(() => {});

  for (let i = 0; i < 14; i++) {
    await page.waitForTimeout(800);
    const confirmed = await page.evaluate(() => {
      const SUCCESS = /thank you|thanks for applying|application (has been )?(received|submitted|sent)|successfully (submitted|applied|sent)|we('| ?ha)?ve received your|your application (is|has been)/i;
      return SUCCESS.test(document.body?.innerText ?? "") || !!document.querySelector('[class*="confirmation"],[data-testid*="success"],[class*="postApply"]');
    });
    if (confirmed) return { result: "submitted" };
  }
  return { result: "needs_user", reason: "entered the code but could not confirm the application went through" };
}
