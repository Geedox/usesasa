// Shared, DOM-driven form filler used by every ATS content script. The pure
// field classification lives in greenhouse-map.ts; this module handles the DOM:
// reading fields, typing values, attaching the résumé, asking the server to
// answer custom questions (grouped, with real labels), and submitting.
import { classifyField, valueForRole, type FillData } from "./greenhouse-map";

export type SubmitResult = "submitted" | "needs_user" | "failed";

export type QuestionType = "text" | "textarea" | "select" | "radio" | "checkbox";
export type FormQuestion = { id: string; label: string; type: QuestionType; options?: string[]; required: boolean };

export type FillInput = {
  fields: FillData;
  coverLetter: string;
  answers: Record<string, string>;
  resumeBase64: string | null;
  resumeName: string;
};

export type FillOptions = {
  submitSelectors: string[];
  submitTextRe: RegExp;
  requestAnswers?: (questions: FormQuestion[]) => Promise<Record<string, string>>;
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
    // Skip internal validation-proxy inputs that custom selects use for HTML
    // `required` (aria-hidden / not tabbable). The visible widget fills them.
    if (el.getAttribute("aria-hidden") === "true" || el.getAttribute("tabindex") === "-1") return false;
    return t === "file" || isVisible(el);
  });

  const handled = new Set<Element>();
  let resumeAttached = false;
  const filled: string[] = [];

  // Phase A: known text fields, résumé, cover letter.
  for (const el of all) {
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
      }
      handled.add(el);
      continue;
    }
    const value = valueForRole(role, data);
    if (value !== null && value !== "") {
      setNativeValue(el, value);
      filled.push(String(role));
      handled.add(el);
      await delay(actionDelay());
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
      label: () => questionLabel(cb),
    });
  }

  // Selects.
  for (const el of all) {
    if (!(el instanceof HTMLSelectElement) || handled.has(el)) continue;
    const opts = Array.from(el.options).map((o) => clean(o.text)).filter((t) => t && !/^(select|choose|\.\.\.)/i.test(t));
    addQ(questionLabel(el), "select", opts, {
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
      label: () => questionLabel(el),
    });
  }

  // Leftover free-text / textarea / custom dropdowns we could not map.
  for (const el of all) {
    if (handled.has(el) || !(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) continue;
    const type = (el as HTMLInputElement).type;
    if (["checkbox", "radio", "file", "hidden"].includes(type)) continue;

    if (el instanceof HTMLTextAreaElement) {
      if (el.value) continue;
      addQ(questionLabel(el), "textarea", undefined, {
        required: isRequired(el),
        fill: (v) => setNativeValue(el, v),
        isFilled: () => !!el.value,
        label: () => questionLabel(el),
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

    const fieldLabel = questionLabel(el) || describeField(el);
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
          await meta[q.id].fill(v);
          await delay(actionDelay());
        }
      }
    } catch (e) {
      console.warn("[sasa] answer generation failed:", e);
    }
  }

  // A label is satisfied if at least one of its controls is now filled.
  const unsatisfied = [...groups.entries()].filter(([, g]) => !g.some((q) => meta[q.id].isFilled()));
  if (unsatisfied.length > 0) {
    const labels = unsatisfied.map(([, g]) => meta[g[0].id].label() || "a question").slice(0, 6);
    const reason = `${unsatisfied.length} required field(s) still need an answer: ${labels.join("; ")}`;
    console.warn(`[sasa] ${reason}`);
    return { result: "needs_user", reason };
  }
  if (!resumeAttached && input.resumeBase64) {
    return { result: "needs_user", reason: "could not attach the resume file" };
  }

  const submit =
    opts.submitSelectors.map((s) => document.querySelector<HTMLButtonElement>(s)).find((b): b is HTMLButtonElement => !!b) ??
    Array.from(document.querySelectorAll("button")).find((b) => opts.submitTextRe.test(b.textContent ?? ""));
  if (!submit) return { result: "needs_user", reason: "could not find the submit button" };

  console.log("[sasa] clicking submit");
  await delay(actionDelay());
  submit.click();
  await delay(3000);
  return { result: "submitted" };
}
