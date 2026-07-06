// Shared, DOM-driven form filler used by every ATS content script. The pure
// field classification lives in greenhouse-map.ts; this module handles the DOM:
// reading fields, typing values, attaching the résumé, asking the server to
// answer custom questions (grouped, with real labels), and submitting.
import { classifyField, valueForRole, type FillData } from "./greenhouse-map";

export type SubmitResult = "submitted" | "needs_user" | "failed" | "prefilled";

export type QuestionType = "text" | "textarea" | "select" | "radio" | "checkbox";
export type FormQuestion = { id: string; label: string; type: QuestionType; options?: string[]; required: boolean };

export type FillInput = {
  fields: FillData;
  coverLetter: string;
  answers: Record<string, string>;
  resumeBase64: string | null;
  resumeName: string;
};

export type CaptchaInfo = { sitekey: string; url: string; enterprise: boolean };

export type FillOptions = {
  submitSelectors: string[];
  submitTextRe: RegExp;
  // Prefill only: fill the fields but never click submit (universal autofill widget).
  noSubmit?: boolean;
  requestAnswers?: (questions: FormQuestion[]) => Promise<Record<string, string>>;
  // Cloud-only: solve a detected captcha out of band (e.g. CapSolver) and return
  // the token. When provided, the engine injects the token instead of waiting for
  // a human. The extension omits this and keeps its in-tab user handoff.
  solveCaptcha?: (info: CaptchaInfo) => Promise<string | null>;
};

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
const actionDelay = () => 400 + Math.floor(Math.random() * 900);
const clean = (s?: string | null) => (s ?? "").replace(/\s+/g, " ").replace(/[\s*]+$/, "").trim();

function setNativeValue(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  setter?.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

// Fill a rich-text / contenteditable editor (Workable, Lever, Draft.js, Quill,
// ProseMirror). These editors keep their own internal model, so a direct
// innerText/textContent assignment is silently discarded. Routing the text through
// execCommand("insertText") drives the editor's own input pipeline; we fall back to
// a beforeinput/input pair for editors that reject execCommand.
function setContentEditable(el: HTMLElement, value: string) {
  el.scrollIntoView({ block: "center" });
  el.focus();
  const sel = window.getSelection();
  if (sel) {
    const range = document.createRange();
    range.selectNodeContents(el); // replace any existing content
    sel.removeAllRanges();
    sel.addRange(range);
  }
  let ok = false;
  try { ok = document.execCommand("insertText", false, value); } catch { ok = false; }
  if (!ok) {
    el.dispatchEvent(new InputEvent("beforeinput", { bubbles: true, cancelable: true, inputType: "insertReplacementText", data: value }));
    el.textContent = value;
    el.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: value }));
  }
  el.dispatchEvent(new Event("change", { bubbles: true }));
  el.blur();
}
const editableFilled = (el: HTMLElement) => clean(el.textContent).length > 0;

function base64ToFile(b64: string, name: string): File {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new File([bytes], name, { type: "application/pdf" });
}

async function waitForForm(timeoutMs = 6000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (document.querySelector("input:not([type=hidden]), textarea, select")) return;
    await delay(250);
  }
}

const isVisible = (el: HTMLElement) => el.offsetParent !== null;
const isRequired = (el: Element) =>
  (el as HTMLInputElement).required ||
  el.getAttribute("aria-required") === "true" ||
  !!el.closest("[aria-required=true], fieldset[aria-required=true]");

// The label of a single option (the text next to a radio/checkbox).
function optionLabel(el: HTMLElement): string {
  const id = el.getAttribute("id");
  if (id) {
    const lab = document.querySelector(`label[for="${CSS.escape(id)}"]`);
    if (clean(lab?.textContent)) return clean(lab!.textContent);
  }
  const wrap = el.closest("label");
  if (clean(wrap?.textContent)) return clean(wrap!.textContent);
  return clean(el.getAttribute("aria-label")) || clean((el as HTMLInputElement).value);
}

const delay2 = (ms: number) => new Promise((r) => setTimeout(r, ms));
// Some ATSes (Ashby) parse the résumé on upload and asynchronously fill the form,
// which wipes anything we typed first. Wait for that autofill to finish before we
// fill the rest. Returns quickly when the form has no such feature.
async function waitForAutofill(): Promise<void> {
  let sawAutofill = false;
  for (let i = 0; i < 14; i++) {
    await delay2(500);
    const t = (document.body?.innerText ?? "").toLowerCase();
    if (/autofill|reading your resume|parsing your resume|filling in/.test(t)) sawAutofill = true;
    if (/autofill (completed|complete|finished|done)|review the information we filled|we filled in for you/.test(t)) {
      await delay2(800);
      return;
    }
    if (!sawAutofill && i >= 3) return; // no autofill feature; stop early (~2s)
  }
}

// The label of the QUESTION a control belongs to. Climbs to a fieldset legend,
// an aria-labelled group, or a label/legend in a nearby ancestor, before falling
// back to the control's own label. This is what avoids "a question".
function questionLabel(el: HTMLElement): string {
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

  // Climb a few ancestors and take a label/legend that does not wrap this control
  // (i.e. the question header sitting above the options).
  let node: HTMLElement | null = el.parentElement;
  for (let i = 0; i < 4 && node; i++, node = node.parentElement) {
    const lbl = node.querySelector("label, legend");
    if (lbl && !lbl.contains(el) && clean(lbl.textContent)) return clean(lbl.textContent);
  }
  return optionLabel(el);
}

// For a STANDALONE field (text, textarea, select, lone checkbox), the control's
// own label is the most accurate. Only climb to a fieldset/section label if the
// control has none, otherwise unrelated section headers ("Application") get
// applied to every field and collapse them together.
function standaloneLabel(el: HTMLElement): string {
  return optionLabel(el) || questionLabel(el);
}

// When a field has no resolvable label, describe it by its attributes + a short
// HTML snippet. This both helps the model and surfaces the markup in our logs so
// unlabeled fields can be fixed without manual DOM inspection.
function describeField(el: HTMLElement): string {
  const a = (n: string) => el.getAttribute(n);
  const attrs = [
    a("name") && `name=${a("name")}`,
    el.id && `id=${el.id}`,
    a("placeholder") && `placeholder=${a("placeholder")}`,
    a("autocomplete") && `autocomplete=${a("autocomplete")}`,
    a("aria-label") && `aria-label=${a("aria-label")}`,
  ].filter(Boolean);
  const html = el.outerHTML.replace(/\s+/g, " ").slice(0, 160);
  return `unlabeled field [${attrs.join(", ") || "no attrs"}] html=${html}`;
}

type QMeta = { required: boolean; fill: (v: string) => void | Promise<void>; isFilled: () => boolean; label: () => string };

// --- Faithful, Playwright-style interaction (trusted-looking event sequences) ---

function fireMouse(el: Element, type: string) {
  el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window, button: 0 }));
}
function firePointer(el: Element, type: string) {
  try {
    el.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, view: window, button: 0, isPrimary: true, pointerType: "mouse" }));
  } catch {
    /* PointerEvent may be unavailable */
  }
}

// A realistic click: the full pointer + mouse sequence a human generates. React
// widgets (react-select, Radix) open on pointerdown/mousedown, which a bare
// .click() never fires.
function realClick(el: HTMLElement) {
  el.scrollIntoView({ block: "center" });
  firePointer(el, "pointerover");
  firePointer(el, "pointerdown");
  fireMouse(el, "mousedown");
  el.focus?.();
  firePointer(el, "pointerup");
  fireMouse(el, "mouseup");
  fireMouse(el, "click");
}

function typeInto(input: HTMLInputElement, text: string) {
  input.focus();
  setNativeValue(input, text);
  input.dispatchEvent(new InputEvent("input", { bubbles: true, data: text, inputType: "insertText" }));
  const last = text.slice(-1) || "a";
  input.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: last }));
  input.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true, key: last }));
}

function pressEnter(el: Element) {
  for (const t of ["keydown", "keypress", "keyup"]) {
    el.dispatchEvent(new KeyboardEvent(t, { bubbles: true, cancelable: true, key: "Enter", code: "Enter", keyCode: 13 } as KeyboardEventInit));
  }
}

// All option-like elements currently in the DOM. Menus often render in a portal
// at the end of <body>, so we search globally.
function optionEls(): HTMLElement[] {
  return Array.from(
    document.querySelectorAll<HTMLElement>('[role=option], [class*="select__option"], [class*="-option"], li[role=option]'),
  ).filter((o) => o.offsetParent !== null);
}

// The element that actually opens a custom select's menu (react-select opens on
// the control's mousedown, not the inner input). NOTE: react-select's input has
// role="combobox", so we must target the control WRAPPER, never the input itself.
function openTarget(el: HTMLElement): HTMLElement {
  const control = el.closest('[class*="select__control"],[class*="-control"]') as HTMLElement | null;
  if (control && control !== el) return control;
  const combo = el.closest('[role=combobox]') as HTMLElement | null;
  if (combo && combo !== el) return combo;
  return el;
}

// Probe a control: snapshot the options already present, open it, and return only
// the options that NEWLY appeared (so always-present lists like the phone country
// dropdown are excluded). Empty result => not a select-style widget.
async function probeOptions(el: HTMLElement): Promise<string[]> {
  const before = new Set<Element>(optionEls());
  realClick(openTarget(el));
  await delay(350);
  const opts = optionEls().filter((o) => !before.has(o)).map((o) => clean(o.textContent)).filter(Boolean);
  el.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Escape" }));
  document.body.click();
  await delay(120);
  return [...new Set(opts)].slice(0, 30);
}

// Open a select-style widget and click the newly-appeared option matching value.
// Polls for options (they render async) and retries, since synthetic clicks on
// react-select don't always register first try.
async function comboSelect(el: HTMLElement, value: string): Promise<void> {
  if (!value) return;
  const want = value.toLowerCase();

  for (let attempt = 0; attempt < 2; attempt++) {
    document.body.click(); // close anything already open
    await delay(120);
    const before = new Set<Element>(optionEls());
    realClick(openTarget(el)); // open the menu (shows all options)
    await delay(200);

    // Poll up to ~1.6s for the option list to render.
    let opts: HTMLElement[] = [];
    for (let i = 0; i < 8; i++) {
      opts = optionEls().filter((o) => !before.has(o));
      if (opts.length) break;
      await delay(200);
    }

    // Long lists: type to filter (the inner input is a search box).
    if (opts.length > 12 && el instanceof HTMLInputElement) {
      typeInto(el, value);
      await delay(450);
      opts = optionEls().filter((o) => !before.has(o));
    }

    const pick =
      opts.find((o) => clean(o.textContent).toLowerCase() === want) ??
      opts.find((o) => clean(o.textContent).toLowerCase().includes(want)) ??
      opts.find((o) => want.includes(clean(o.textContent).toLowerCase()) && clean(o.textContent).length > 2);
    if (pick) {
      realClick(pick);
      await delay(350);
    } else {
      pressEnter(el);
      await delay(250);
    }
    if (comboFilled(el, value)) return;
  }
  console.warn(`[sasa] combo may not have registered: "${value.slice(0, 40)}"`);
}

// Fill a plain text input, but cope with autocompletes (type, then click a newly
// appeared matching suggestion, e.g. a location field).
async function smartText(el: HTMLInputElement, value: string): Promise<void> {
  if (!value) return;
  const before = new Set<Element>(optionEls());
  realClick(el);
  typeInto(el, value);
  await delay(400);
  const want = value.toLowerCase();
  const opts = optionEls().filter((o) => !before.has(o));
  // Only click a suggestion that actually matches; otherwise keep the typed text
  // (clicking a non-matching first suggestion was clearing the field).
  const pick = opts.find((o) => clean(o.textContent).toLowerCase().includes(want));
  if (pick) {
    realClick(pick);
    await delay(200);
  }
}

// Did a select/combobox end up showing the chosen value? IMPORTANT: verify
// against the control container, not the captured input — `.select__input`'s own
// class contains "select", so closest() would match the input (no value/text).
function comboFilled(el: HTMLElement, value: string): boolean {
  if (!value) return false;
  const want = value.toLowerCase();
  const v = (el as HTMLInputElement).value;
  if (v && v.toLowerCase().includes(want)) return true;
  // The control (or its container) is where react-select renders the chosen value.
  const control = openTarget(el);
  const box = control.closest('[class*="container"],[class*="shell"]') ?? control;
  const sv = box.querySelector('[class*="single-value"],[class*="singleValue"],[class*="multiValue"],[class*="multi-value"]');
  if (sv && clean(sv.textContent)) {
    const t = clean(sv.textContent).toLowerCase();
    return t.includes(want) || want.includes(t);
  }
  // Fall back to the control's text, but ignore the placeholder ("Select...").
  const txt = clean(box.textContent).toLowerCase();
  if (/^select\.\.\.?$/.test(txt) || txt === "") return false;
  return txt.includes(want);
}

export async function fillAndSubmit(input: FillInput, opts: FillOptions): Promise<{ result: SubmitResult; reason?: string }> {
  await waitForForm();

  const data: FillData = input.fields;
  const all = Array.from(
    document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>("input, textarea, select"),
  ).filter((el) => {
    const t = (el as HTMLInputElement).type;
    if (t === "hidden") return false;
    // Keep file inputs even when visually hidden behind a styled dropzone.
    if (t === "file") return true;
    // Skip internal validation-proxy inputs that custom selects use for HTML
    // `required` (aria-hidden / not tabbable). The visible widget fills them.
    if (el.getAttribute("aria-hidden") === "true" || el.getAttribute("tabindex") === "-1") return false;
    return isVisible(el);
  });

  // Rich-text editors used for cover letters / long answers (Workable, Lever, and
  // anything built on Draft.js/Quill/ProseMirror) are contenteditable, not <textarea>,
  // so they never appear in `all`. Collect them separately and fill them too.
  const editables = Array.from(document.querySelectorAll<HTMLElement>('[contenteditable="true"], [contenteditable=""]')).filter(
    (el) => isVisible(el) && el.getAttribute("aria-hidden") !== "true" && !el.closest("#sasa-autofill-root"),
  );

  const handled = new Set<Element>();
  let resumeAttached = false;
  const filled: string[] = [];
  // Track filled values so we can reassert them if the ATS autofill wipes them.
  const knownFills: { el: HTMLInputElement | HTMLTextAreaElement; value: string }[] = [];
  const answerMap: Record<string, string> = {};

  // Attach the résumé to the real résumé field. Crucially, SKIP any "autofill from
  // resume" dropzone — uploading there makes the ATS (e.g. Ashby) parse the file and
  // reset the whole form, wiping our answers. We fill the fields ourselves instead.
  const fileCtx = (el: HTMLElement) =>
    `${optionLabel(el)} ${el.closest("div,fieldset,section,label")?.textContent ?? ""}`.replace(/\s+/g, " ").slice(0, 200).toLowerCase();
  for (const el of all) {
    if (!(el instanceof HTMLInputElement) || el.type !== "file" || !input.resumeBase64) continue;
    const r = classifyField({ name: el.getAttribute("name") ?? "", id: el.id, label: optionLabel(el), type: "file" });
    if (r !== "resume") continue;
    if (/autofill/.test(fileCtx(el))) {
      handled.add(el); // skip the autofill dropzone — do not trigger résumé parsing
      console.log("[sasa] skipping autofill-from-resume dropzone");
      continue;
    }
    const dt = new DataTransfer();
    dt.items.add(base64ToFile(input.resumeBase64, input.resumeName));
    el.files = dt.files;
    el.dispatchEvent(new Event("change", { bubbles: true }));
    resumeAttached = true;
    handled.add(el);
  }
  if (resumeAttached) await waitForAutofill();

  // Phase A: known text fields, résumé, cover letter.
  for (const el of all) {
    if (handled.has(el)) continue;
    if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) continue;
    const type = (el as HTMLInputElement).type;
    if (type === "checkbox" || type === "radio") continue; // grouped in Phase B
    const role = classifyField({
      name: el.getAttribute("name") ?? "",
      id: el.id,
      label: optionLabel(el),
      type,
      placeholder: (el as HTMLInputElement).placeholder,
      autocomplete: el.getAttribute("autocomplete") ?? "",
    });
    if (role === "resume") {
      if (input.resumeBase64) {
        const dt = new DataTransfer();
        dt.items.add(base64ToFile(input.resumeBase64, input.resumeName));
        (el as HTMLInputElement).files = dt.files;
        el.dispatchEvent(new Event("change", { bubbles: true }));
        resumeAttached = true;
      }
      handled.add(el);
      continue;
    }
    if (role === "coverLetter") {
      if (el instanceof HTMLTextAreaElement) {
        setNativeValue(el, input.coverLetter);
        filled.push("coverLetter");
        knownFills.push({ el, value: input.coverLetter });
      }
      handled.add(el);
      continue;
    }
    const value = valueForRole(role, data);
    if (value !== null && value !== "") {
      setNativeValue(el, value);
      filled.push(String(role));
      knownFills.push({ el, value });
      handled.add(el);
      await delay(actionDelay());
    }
  }

  // Phase A2: rich-text cover-letter editor (contenteditable). Classified the same
  // way as a textarea; filled through the editor's own input pipeline.
  for (const el of editables) {
    if (handled.has(el)) continue;
    const role = classifyField({
      name: el.getAttribute("name") ?? "",
      id: el.id,
      label: standaloneLabel(el),
      type: "textarea",
      placeholder: el.getAttribute("aria-label") ?? el.getAttribute("data-placeholder") ?? "",
      autocomplete: "",
    });
    if (role === "coverLetter") {
      if (input.coverLetter && !editableFilled(el)) {
        setContentEditable(el, input.coverLetter);
        filled.push("coverLetter");
      }
      handled.add(el);
    }
  }

  // Phase B: build grouped questions for everything not yet handled.
  const questions: FormQuestion[] = [];
  const meta: Record<string, QMeta> = {};
  let qi = 0;
  const addQ = (label: string, type: QuestionType, options: string[] | undefined, m: QMeta) => {
    const id = `q${qi++}`;
    questions.push({ id, label: (label || "Question").slice(0, 200), type, options, required: m.required });
    meta[id] = m;
  };

  // Radio groups (by name).
  const seenRadio = new Set<string>();
  for (const el of all) {
    if (!(el instanceof HTMLInputElement) || el.type !== "radio" || !el.name || seenRadio.has(el.name)) continue;
    seenRadio.add(el.name);
    const group = Array.from(document.querySelectorAll<HTMLInputElement>(`input[type=radio][name="${CSS.escape(el.name)}"]`));
    const pick = (v: string) => {
      const w = v.toLowerCase();
      (group.find((r) => optionLabel(r).toLowerCase() === w) ?? group.find((r) => optionLabel(r).toLowerCase().includes(w)))?.click();
    };
    addQ(questionLabel(el), "radio", group.map(optionLabel).filter(Boolean), {
      required: group.some(isRequired),
      fill: pick,
      isFilled: () => group.some((r) => r.checked),
      label: () => questionLabel(el),
    });
  }

  // Checkboxes: group by name. A group of 2+ is a "pick one of these options"
  // question; a lone checkbox is a yes/no (consent) question.
  const cbByName = new Map<string, HTMLInputElement[]>();
  const singles: HTMLInputElement[] = [];
  for (const el of all) {
    if (!(el instanceof HTMLInputElement) || el.type !== "checkbox") continue;
    if (el.name) cbByName.set(el.name, [...(cbByName.get(el.name) ?? []), el]);
    else singles.push(el);
  }
  for (const [, group] of cbByName) {
    if (group.length > 1) {
      const pick = (v: string) => {
        const w = v.toLowerCase();
        const c = group.find((x) => optionLabel(x).toLowerCase() === w) ?? group.find((x) => optionLabel(x).toLowerCase().includes(w));
        if (c && !c.checked) c.click();
      };
      addQ(questionLabel(group[0]), "select", group.map(optionLabel).filter(Boolean), {
        required: group.some(isRequired),
        fill: pick,
        isFilled: () => group.some((x) => x.checked),
        label: () => questionLabel(group[0]),
      });
    } else singles.push(group[0]);
  }
  for (const cb of singles) {
    addQ(questionLabel(cb), "checkbox", undefined, {
      required: isRequired(cb),
      fill: (v) => {
        const yes = /^(yes|true|1|i agree|agree|accept|acknowledge|confirm)/i.test(v);
        if (yes !== cb.checked) cb.click();
      },
      isFilled: () => cb.checked,
      label: () => standaloneLabel(cb),
    });
  }

  // Selects.
  for (const el of all) {
    if (!(el instanceof HTMLSelectElement) || handled.has(el)) continue;
    const opts = Array.from(el.options).map((o) => clean(o.text)).filter((t) => t && !/^(select|choose|\.\.\.)/i.test(t));
    addQ(standaloneLabel(el), "select", opts, {
      required: isRequired(el),
      fill: (v) => {
        const w = v.toLowerCase();
        const o = Array.from(el.options).find((x) => clean(x.text).toLowerCase() === w || clean(x.text).toLowerCase().includes(w));
        if (o) {
          el.value = o.value;
          el.dispatchEvent(new Event("change", { bubbles: true }));
        }
      },
      isFilled: () => !!el.value && !/^(select|choose|\.\.\.)/i.test(el.options[el.selectedIndex]?.text ?? ""),
      label: () => standaloneLabel(el),
    });
  }

  // Leftover free-text / textarea / custom dropdowns we could not map.
  for (const el of all) {
    if (handled.has(el) || !(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) continue;
    const type = (el as HTMLInputElement).type;
    if (["checkbox", "radio", "file", "hidden"].includes(type)) continue;

    if (el instanceof HTMLTextAreaElement) {
      if (el.value) continue;
      addQ(standaloneLabel(el), "textarea", undefined, {
        required: isRequired(el),
        fill: (v) => setNativeValue(el, v),
        isFilled: () => !!el.value,
        label: () => standaloneLabel(el),
      });
      continue;
    }

    // Text-like input: probe by opening it. If a real option list appears it is a
    // select-style widget (give the agent the options); otherwise treat as text
    // (and still cope with autocompletes at fill time).
    const options = await probeOptions(el);
    const chosen = { v: "" };

    // International phone widget: opening it reveals a country dial-code list. Do
    // NOT treat that as a dropdown question — type the phone number into it.
    if (options.length >= 5 && options.filter((o) => /\+\s?\d{1,4}/.test(o)).length >= options.length * 0.5) {
      if (data.phone) {
        el.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Escape" }));
        document.body.click();
        typeInto(el, data.phone);
        filled.push("phone");
        console.log("[sasa] phone widget filled with number");
      }
      handled.add(el);
      continue;
    }

    const fieldLabel = standaloneLabel(el) || describeField(el);
    if (options.length > 0) {
      addQ(fieldLabel, "select", options, {
        required: isRequired(el),
        fill: async (v) => {
          chosen.v = v;
          await comboSelect(el, v);
        },
        isFilled: () => comboFilled(el, chosen.v),
        label: () => fieldLabel,
      });
    } else {
      if (el.value) continue;
      addQ(fieldLabel, "text", undefined, {
        required: isRequired(el),
        fill: async (v) => {
          chosen.v = v;
          await smartText(el, v);
        },
        isFilled: () => !!el.value || comboFilled(el, chosen.v),
        label: () => fieldLabel,
      });
    }
  }

  // Leftover rich-text editors (contenteditable long-answer questions) → textareas.
  for (const el of editables) {
    if (handled.has(el)) continue;
    if (editableFilled(el)) { handled.add(el); continue; }
    addQ(standaloneLabel(el), "textarea", undefined, {
      required: isRequired(el),
      fill: (v) => setContentEditable(el, v),
      isFilled: () => editableFilled(el),
      label: () => standaloneLabel(el),
    });
    handled.add(el);
  }

  // Only ask about REQUIRED questions (leave optional fields, e.g. demographics, alone).
  const ask = questions.filter((q) => meta[q.id].required);

  // Dedup by label: the same logical field is often duplicated in the DOM. Ask the
  // agent once per label, then fill every copy that shares it.
  const groups = new Map<string, FormQuestion[]>();
  for (const q of ask) groups.set(q.label.toLowerCase(), [...(groups.get(q.label.toLowerCase()) ?? []), q]);
  const unique = [...groups.values()].map((g) => {
    const opts = [...new Set(g.flatMap((q) => q.options ?? []))];
    return { ...g[0], options: opts.length ? opts : undefined };
  });

  console.log(`[sasa] filled: ${filled.join(", ") || "nothing"}. resume: ${resumeAttached}. required questions: ${unique.length} (${ask.length} controls).`);

  if (unique.length > 0 && opts.requestAnswers) {
    try {
      console.log("[sasa] asking:", unique.map((q) => `${q.label} [${q.type}]`));
      const answers = await opts.requestAnswers(unique);
      for (const u of unique) {
        const v = answers[u.id];
        if (!v) continue;
        for (const q of groups.get(u.label.toLowerCase()) ?? []) {
          answerMap[q.id] = v;
          await meta[q.id].fill(v);
          await delay(actionDelay());
        }
      }
    } catch (e) {
      console.warn("[sasa] answer generation failed:", e);
    }
  }

  // Reassert pass: some ATSes (Ashby) run an async "autofill from resume" that
  // wipes fields AFTER we set them. Wait for it to settle, then re-fill anything
  // that got cleared — investigate and fix, don't give up.
  for (let pass = 0; pass < 3; pass++) {
    await delay(1000);
    let refilled = 0;
    for (const { el, value } of knownFills) {
      if (!el.value) {
        setNativeValue(el, value);
        refilled++;
      }
    }
    for (const q of ask) {
      const v = answerMap[q.id];
      if (v && !meta[q.id].isFilled()) {
        await meta[q.id].fill(v);
        refilled++;
      }
    }
    if (refilled === 0) break;
    console.log(`[sasa] reasserted ${refilled} field(s) that were cleared (autofill)`);
  }

  // Pre-submit sweep: SPA forms (the new Greenhouse) render some required fields
  // only after earlier ones are filled (e.g. Country appears once Location is set).
  // Re-scan for required, visible controls we never handled and fill them too —
  // investigate and fill, don't give up.
  type SweepQ = { id: string; label: string; type: QuestionType; options?: string[]; fill: (v: string) => Promise<void> | void; isFilled: () => boolean };
  const sweepQ: SweepQ[] = [];
  let swi = 0;
  const seenSweepRadio = new Set<string>();
  // Re-fill any required control still empty before we submit. This catches both
  // late-rendered SPA fields (e.g. Greenhouse renders Country after Location) and
  // ones an earlier pass set but that did not stick. We EXCLUDE radios/checkboxes
  // (already grouped above — re-scanning them would duplicate each option as its
  // own question) and skip combos/selects that already show a value.
  const comboShowsValue = (el: HTMLElement): boolean => {
    const control = el.closest('[class*="select__control"],[class*="-control"],[role="combobox"]');
    if (!control) return false;
    const box = control.closest('[class*="container"],[class*="shell"]') ?? control;
    const sv = box.querySelector('[class*="single-value"],[class*="singleValue"],[class*="multi-value"],[class*="multiValue"]');
    return !!(sv && clean(sv.textContent));
  };
  const liveControls = Array.from(document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>("input, textarea, select")).filter((el) => {
    const t = (el as HTMLInputElement).type;
    if (t === "hidden" || t === "file" || t === "radio" || t === "checkbox") return false;
    if (el.getAttribute("aria-hidden") === "true" || el.getAttribute("tabindex") === "-1") return false;
    if (!isVisible(el) || !isRequired(el)) return false;
    if (el instanceof HTMLSelectElement) return !el.value || /^(select|choose|\.\.\.)/i.test(el.options[el.selectedIndex]?.text ?? "");
    return !(el as HTMLInputElement).value && !comboShowsValue(el);
  });
  for (const el of liveControls) {
    const id = `s${swi++}`;
    if (el instanceof HTMLSelectElement) {
      if (el.value && !/^(select|choose|\.\.\.)/i.test(el.options[el.selectedIndex]?.text ?? "")) continue;
      const o = Array.from(el.options).map((x) => clean(x.text)).filter((t) => t && !/^(select|choose|\.\.\.)/i.test(t));
      sweepQ.push({ id, label: standaloneLabel(el), type: "select", options: o, isFilled: () => !!el.value && !/^(select|choose|\.\.\.)/i.test(el.options[el.selectedIndex]?.text ?? ""),
        fill: (v) => { const w = v.toLowerCase(); const m = Array.from(el.options).find((x) => clean(x.text).toLowerCase() === w || clean(x.text).toLowerCase().includes(w)); if (m) { el.value = m.value; el.dispatchEvent(new Event("change", { bubbles: true })); } } });
    } else if (el instanceof HTMLInputElement && el.type === "radio") {
      if (!el.name || seenSweepRadio.has(el.name)) continue;
      seenSweepRadio.add(el.name);
      const group = Array.from(document.querySelectorAll<HTMLInputElement>(`input[type=radio][name="${CSS.escape(el.name)}"]`));
      if (group.some((r) => r.checked)) continue;
      sweepQ.push({ id, label: questionLabel(el), type: "radio", options: group.map(optionLabel).filter(Boolean), isFilled: () => group.some((r) => r.checked),
        fill: (v) => { const w = v.toLowerCase(); (group.find((r) => optionLabel(r).toLowerCase() === w) ?? group.find((r) => optionLabel(r).toLowerCase().includes(w)))?.click(); } });
    } else if (el instanceof HTMLInputElement && el.type === "checkbox") {
      if (el.checked) continue;
      sweepQ.push({ id, label: standaloneLabel(el), type: "checkbox", isFilled: () => el.checked,
        fill: (v) => { const yes = /^(yes|true|1|i agree|agree|accept|acknowledge|confirm)/i.test(v); if (yes !== el.checked) el.click(); } });
    } else if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      if (el.value) continue;
      const chosen = { v: "" };
      const options = el instanceof HTMLInputElement ? await probeOptions(el) : [];
      const label = standaloneLabel(el) || describeField(el);
      if (options.length > 0) {
        sweepQ.push({ id, label, type: "select", options, isFilled: () => comboFilled(el, chosen.v), fill: async (v) => { chosen.v = v; await comboSelect(el as HTMLInputElement, v); } });
      } else {
        sweepQ.push({ id, label, type: "text", isFilled: () => !!el.value || comboFilled(el, chosen.v), fill: async (v) => { chosen.v = v; if (el instanceof HTMLTextAreaElement) setNativeValue(el, v); else await smartText(el, v); } });
      }
    }
    handled.add(el);
  }
  const sweepAnswers: Record<string, string> = {};
  if (sweepQ.length > 0 && opts.requestAnswers) {
    console.log(`[sasa] pre-submit sweep: ${sweepQ.length} late required field(s):`, sweepQ.map((q) => q.label));
    try {
      const answers = await opts.requestAnswers(sweepQ.map((q) => ({ id: q.id, label: q.label, type: q.type, options: q.options, required: true })));
      for (const q of sweepQ) {
        const v = answers[q.id];
        if (!v) continue;
        sweepAnswers[q.id] = v;
        await q.fill(v);
        await delay(actionDelay());
      }
    } catch (e) {
      console.warn("[sasa] sweep answer failed:", e);
    }
  }

  // Final stabilization: this SPA re-renders as late fields appear (filling Country
  // can wipe other react-selects). Re-assert every known value + answer until the
  // form stops resetting or we run out of tries. This is the "don't give up, keep
  // filling" guarantee right before submit.
  for (let pass = 0; pass < 5; pass++) {
    await delay(900);
    let fixed = 0;
    for (const { el, value } of knownFills) if (!el.value) { setNativeValue(el, value); fixed++; }
    for (const q of ask) { const v = answerMap[q.id]; if (v && !meta[q.id].isFilled()) { await meta[q.id].fill(v); fixed++; } }
    for (const q of sweepQ) { const v = sweepAnswers[q.id]; if (v && !q.isFilled()) { await q.fill(v); fixed++; } }
    if (fixed === 0) break;
    console.log(`[sasa] stabilized ${fixed} field(s) the form had reset`);
  }

  // Last resort: a required dropdown/radio we still could not answer must NEVER
  // block the whole submission (e.g. a US-state list shown to someone based in
  // Lagos). Pick the first real option so the form proceeds — an imperfect value
  // the user can review beats a stuck application.
  const firstOption = (options?: string[]) => (options ?? []).find((o) => o && !/^(select|choose|please|\.\.\.)/i.test(o.trim()));
  for (const q of ask) {
    if ((q.type === "select" || q.type === "radio") && !meta[q.id].isFilled()) {
      const o = firstOption(q.options);
      if (o) {
        await meta[q.id].fill(o);
        await delay(400);
        if (meta[q.id].isFilled()) console.log(`[sasa] no good answer for "${meta[q.id].label()}" — defaulted to "${o}" so submission can proceed`);
      }
    }
  }
  for (const q of sweepQ) {
    if ((q.type === "select" || q.type === "radio") && !q.isFilled()) {
      const o = firstOption(q.options);
      if (o) {
        await q.fill(o);
        await delay(400);
        if (q.isFilled()) console.log(`[sasa] no good answer for "${q.label}" — defaulted to "${o}" so submission can proceed`);
      }
    }
  }

  // A label is satisfied if at least one of its controls is now filled.
  const unsatisfied = [...groups.entries()].filter(([, g]) => !g.some((q) => meta[q.id].isFilled()));
  const sweepUnsat = sweepQ.filter((q) => !q.isFilled());
  if (unsatisfied.length > 0 || sweepUnsat.length > 0) {
    const labels = [...unsatisfied.map(([, g]) => meta[g[0].id].label() || "a question"), ...sweepUnsat.map((q) => q.label || "a question")].slice(0, 6);
    const reason = `${unsatisfied.length + sweepUnsat.length} required field(s) still need an answer: ${labels.join("; ")}`;
    console.warn(`[sasa] ${reason}`);
    return { result: "needs_user", reason };
  }
  if (!resumeAttached && input.resumeBase64) {
    return { result: "needs_user", reason: "could not attach the resume file" };
  }

  // Universal autofill widget: fields are filled, leave submitting to the user.
  if (opts.noSubmit) return { result: "prefilled" };

  const submit =
    opts.submitSelectors.map((s) => document.querySelector<HTMLButtonElement>(s)).find((b): b is HTMLButtonElement => !!b) ??
    Array.from(document.querySelectorAll("button")).find((b) => opts.submitTextRe.test(b.textContent ?? ""));
  if (!submit) return { result: "needs_user", reason: "could not find the submit button" };

  console.log("[sasa] clicking submit");
  await delay(actionDelay());
  realClick(submit);

  // Verify the application was actually accepted — never report "submitted" just
  // because we clicked. Poll for a real confirmation signal.
  if (await verifySubmitted()) {
    console.log("[sasa] confirmation detected");
    return { result: "submitted" };
  }

  // Not confirmed. An unfilled required field is the common real cause.
  const emptyRequired = Array.from(document.querySelectorAll<HTMLElement>("input, textarea, select")).find((e) => {
    const el = e as HTMLInputElement;
    if (!isRequired(el) || el.type === "hidden" || el.getAttribute("aria-hidden") === "true") return false;
    if (el.type === "file") return el.files?.length === 0;
    if (el.type === "radio" || el.type === "checkbox") return false;
    if (el.value) return false;
    // A react-select/combobox input is always value-empty (the chosen value lives
    // in the control's single-value element). Treat it as filled if the widget
    // shows a value — checking el.value alone would false-flag every dropdown.
    const control = el.closest('[class*="select__control"],[class*="-control"],[role="combobox"]');
    if (control) {
      const box = control.closest('[class*="container"],[class*="shell"]') ?? control;
      const sv = box.querySelector('[class*="single-value"],[class*="singleValue"],[class*="multi-value"],[class*="multiValue"]');
      if (sv && clean(sv.textContent)) return false;
    }
    return true;
  });
  if (emptyRequired) {
    return { result: "needs_user", reason: "some required fields did not stick after filling; please review the open tab" };
  }

  // A genuine captcha widget (real recaptcha/hcaptcha iframe, not just a class match).
  const realCaptcha = Array.from(document.querySelectorAll<HTMLIFrameElement>("iframe")).some(
    (f) => /recaptcha\/api2\/(anchor|bframe)|hcaptcha\.com\/(captcha|checkbox)/.test(f.src) && f.offsetParent !== null,
  );
  if (realCaptcha && opts.solveCaptcha) {
    // Cloud path: solve the captcha out of band and inject the token, no human.
    const token = await solveCaptchaAndInject(opts.solveCaptcha);
    if (token) {
      console.log("[sasa] captcha token injected — submitting");
      await delay(500);
      if (document.body.contains(submit)) realClick(submit);
      if (await verifySubmitted()) {
        console.log("[sasa] confirmation detected after captcha solve");
        return { result: "submitted" };
      }
      return { result: "needs_user", reason: "submitted with a solved captcha but could not confirm the application went through" };
    }
    return { result: "needs_user", reason: "a captcha is blocking the submit and it could not be solved automatically" };
  }
  if (realCaptcha) {
    // Smart handoff: the tab is open and fully filled. Wait for the user to solve
    // the captcha in it, then it either auto-submits or they click submit; either
    // way we watch for the confirmation and only then report submitted.
    console.log("[sasa] captcha detected — waiting up to 2 min for you to complete it in the open tab");
    for (let i = 0; i < 60; i++) {
      await delay(2000);
      if (isConfirmed()) {
        console.log("[sasa] confirmation detected after captcha");
        return { result: "submitted" };
      }
      // If the captcha got solved but the form did not auto-submit, click submit.
      const token = document.querySelector<HTMLTextAreaElement>('textarea[name="g-recaptcha-response"], textarea[name="h-captcha-response"]');
      if (token && token.value && document.body.contains(submit)) realClick(submit);
    }
    return {
      result: "needs_user",
      reason: "a captcha is blocking the submit; open the tab, complete the captcha and click submit (everything else is filled)",
    };
  }

  return { result: "needs_user", reason: "clicked submit but could not confirm the application went through" };
}

// Read the reCAPTCHA sitekey from the page (data attribute or the challenge
// iframe's `k` param) and whether it is the enterprise variant.
function readCaptchaInfo(): { sitekey: string; enterprise: boolean } | null {
  const dataKey = document.querySelector("[data-sitekey]")?.getAttribute("data-sitekey");
  let sitekey = dataKey ?? "";
  if (!sitekey) {
    for (const f of Array.from(document.querySelectorAll<HTMLIFrameElement>("iframe"))) {
      if (/recaptcha\/(api2|enterprise)/.test(f.src)) {
        try {
          const k = new URL(f.src).searchParams.get("k");
          if (k) { sitekey = k; break; }
        } catch { /* ignore */ }
      }
    }
  }
  if (!sitekey) return null;
  const enterprise = Array.from(document.querySelectorAll("iframe")).some((f) => /recaptcha\/enterprise/.test((f as HTMLIFrameElement).src)) ||
    typeof (window as unknown as { grecaptcha?: { enterprise?: unknown } }).grecaptcha?.enterprise !== "undefined";
  return { sitekey, enterprise };
}

// Ask the solver for a token, inject it into the response field(s), and fire the
// site's reCAPTCHA callback so the form treats the challenge as passed.
async function solveCaptchaAndInject(
  solve: (info: { sitekey: string; url: string; enterprise: boolean }) => Promise<string | null>,
): Promise<string | null> {
  const info = readCaptchaInfo();
  if (!info) return null;
  console.log(`[sasa] solving captcha (sitekey ${info.sitekey.slice(0, 12)}…, enterprise=${info.enterprise})`);
  const token = await solve({ sitekey: info.sitekey, url: location.href, enterprise: info.enterprise });
  if (!token) return null;
  for (const ta of Array.from(document.querySelectorAll<HTMLTextAreaElement>('textarea[name="g-recaptcha-response"], textarea[id^="g-recaptcha-response"]'))) {
    ta.value = token;
    ta.dispatchEvent(new Event("input", { bubbles: true }));
    ta.dispatchEvent(new Event("change", { bubbles: true }));
  }
  // Best-effort: invoke the registered callback so invisible/v2 widgets proceed.
  try {
    const cfg = (window as unknown as { ___grecaptcha_cfg?: { clients?: Record<string, unknown> } }).___grecaptcha_cfg;
    const clients = cfg?.clients ?? {};
    for (const client of Object.values(clients)) {
      const walk = (o: unknown) => {
        if (!o || typeof o !== "object") return;
        for (const v of Object.values(o as Record<string, unknown>)) {
          if (v && typeof v === "object" && "callback" in (v as object)) {
            const cb = (v as { callback?: unknown }).callback;
            if (typeof cb === "function") { try { (cb as (t: string) => void)(token); } catch { /* ignore */ } }
          } else if (v && typeof v === "object") walk(v);
        }
      };
      walk(client);
    }
  } catch { /* ignore */ }
  return token;
}

// A single-shot check for a post-submit success signal.
function isConfirmed(): boolean {
  const SUCCESS =
    /thank you|thanks for applying|application (has been )?(received|submitted|sent)|successfully (submitted|applied|sent)|we('| ?ha)?ve received your|submission (received|complete|successful)|your application (is|has been)/i;
  const txt = document.body?.innerText ?? "";
  if (SUCCESS.test(txt)) return true;
  if (document.querySelector('[class*="confirmation"],[class*="application-confirmation"],[data-testid*="success"],[data-testid*="confirmation"],[class*="postApply"]')) return true;
  return !document.querySelector('input[type=file], button[type=submit]'); // form gone
}

// Poll for confirmation. Conservative on purpose — a false "submitted" (charging
// for an application that never went through) is worse than a false "needs_user".
async function verifySubmitted(): Promise<boolean> {
  for (let i = 0; i < 8; i++) {
    await delay(700);
    if (isConfirmed()) return true;
  }
  return false;
}
