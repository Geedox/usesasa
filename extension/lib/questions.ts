// Lightweight form-question scanner + applier for the universal widget's
// "suggest answers" panel. Keyed by visible label so it works the same in any frame
// (the form may be in an iframe). Standard fields (name/email/links/resume/cover)
// are skipped — those are handled by the prefill engine.

export type ScannedQuestion = { label: string; type: "text" | "textarea" | "select" | "radio" | "checkbox"; options?: string[] };

const STD = /first[\s_-]*name|last[\s_-]*name|full[\s_-]*name|\bname\b|e-?mail|phone|tel\b|mobile|linkedin|github|portfolio|website|resume|\bcv\b|cover[\s_-]*letter|upload|attach/i;

const clean = (s?: string | null) => (s ?? "").replace(/\s+/g, " ").replace(/[\s*:]+$/, "").trim();
const visible = (el: HTMLElement) => el.offsetParent !== null;

function labelFor(el: Element): string {
  const id = (el as HTMLElement).id;
  if (id) {
    const l = document.querySelector(`label[for="${(window as unknown as { CSS: typeof CSS }).CSS.escape(id)}"]`);
    if (l) return clean(l.textContent);
  }
  const wrap = el.closest("label");
  if (wrap) return clean(wrap.textContent);
  const aria = el.getAttribute("aria-label");
  if (aria) return clean(aria);
  const lb = el.getAttribute("aria-labelledby");
  if (lb) { const r = document.getElementById(lb); if (r) return clean(r.textContent); }
  // group label (radio/checkbox): nearest fieldset legend
  const legend = el.closest("fieldset")?.querySelector("legend");
  if (legend) return clean(legend.textContent);
  // preceding label-ish element
  const prev = el.previousElementSibling;
  if (prev && /label|span|p|div/i.test(prev.tagName)) { const t = clean(prev.textContent); if (t && t.length < 160) return t; }
  return clean((el as HTMLInputElement).placeholder);
}

function isStd(el: Element, label: string): boolean {
  const hay = `${label} ${el.getAttribute("name") ?? ""} ${(el as HTMLElement).id} ${el.getAttribute("placeholder") ?? ""} ${el.getAttribute("autocomplete") ?? ""}`;
  return STD.test(hay);
}

function setNativeValue(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

// Fill a contenteditable rich-text editor (Draft.js/Quill/ProseMirror) through its
// own input pipeline; direct textContent assignment is ignored by these editors.
function setEditable(el: HTMLElement, value: string) {
  el.focus();
  const sel = window.getSelection();
  if (sel) { const r = document.createRange(); r.selectNodeContents(el); sel.removeAllRanges(); sel.addRange(r); }
  let ok = false;
  try { ok = document.execCommand("insertText", false, value); } catch { ok = false; }
  if (!ok) {
    el.textContent = value;
    el.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: value }));
  }
  el.dispatchEvent(new Event("change", { bubbles: true }));
  el.blur();
}
const editables = () =>
  Array.from(document.querySelectorAll<HTMLElement>('[contenteditable="true"], [contenteditable=""]')).filter(
    (el) => visible(el) && el.getAttribute("aria-hidden") !== "true" && !el.closest("#sasa-autofill-root"),
  );

export function scanQuestions(): ScannedQuestion[] {
  const out: ScannedQuestion[] = [];
  const seen = new Set<string>();
  const add = (q: ScannedQuestion) => {
    const key = q.label.toLowerCase();
    if (!q.label || seen.has(key)) return;
    seen.add(key);
    out.push(q);
  };

  // text / textarea / select
  for (const el of Array.from(document.querySelectorAll<HTMLElement>("input, textarea, select"))) {
    if (!visible(el)) continue;
    const tag = el.tagName.toLowerCase();
    const type = (el as HTMLInputElement).type;
    if (tag === "input" && ["hidden", "file", "submit", "button", "checkbox", "radio", "password"].includes(type)) continue;
    const label = labelFor(el);
    if (!label || isStd(el, label)) continue;
    if (tag === "select") {
      const opts = Array.from((el as HTMLSelectElement).options).map((o) => clean(o.text)).filter((t) => t && !/^(select|choose|\.\.\.|--)/i.test(t));
      add({ label, type: "select", options: opts });
    } else if (tag === "textarea") {
      add({ label, type: "textarea" });
    } else {
      add({ label, type: "text" });
    }
  }

  // radio groups by name
  const radioNames = new Set<string>();
  for (const el of Array.from(document.querySelectorAll<HTMLInputElement>('input[type="radio"]'))) {
    if (!visible(el) || !el.name || radioNames.has(el.name)) continue;
    radioNames.add(el.name);
    const group = Array.from(document.querySelectorAll<HTMLInputElement>(`input[type=radio][name="${(window as unknown as { CSS: typeof CSS }).CSS.escape(el.name)}"]`));
    const label = labelFor(el);
    const options = group.map((g) => labelFor(g)).filter(Boolean);
    if (label) add({ label, type: "radio", options });
  }

  // standalone checkboxes
  for (const el of Array.from(document.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'))) {
    if (!visible(el)) continue;
    const label = labelFor(el);
    if (label && !isStd(el, label)) add({ label, type: "checkbox" });
  }

  // rich-text editors (contenteditable) — long-answer questions on Workable/Lever etc.
  for (const el of editables()) {
    const label = labelFor(el);
    if (label && !isStd(el, label)) add({ label, type: "textarea" });
  }

  return out;
}

export function applyAnswers(answers: Record<string, string>): number {
  const byLabel = new Map(Object.entries(answers).map(([k, v]) => [k.toLowerCase(), v]));
  let n = 0;

  for (const el of Array.from(document.querySelectorAll<HTMLElement>("input, textarea, select"))) {
    if (!visible(el)) continue;
    const label = labelFor(el).toLowerCase();
    const value = byLabel.get(label);
    if (!value) continue;
    const tag = el.tagName.toLowerCase();
    const type = (el as HTMLInputElement).type;

    if (tag === "textarea" || (tag === "input" && ["text", "email", "tel", "url", "number", ""].includes(type))) {
      setNativeValue(el as HTMLInputElement, value);
      n++;
    } else if (tag === "select") {
      const sel = el as HTMLSelectElement;
      const opt = Array.from(sel.options).find((o) => o.text.trim().toLowerCase() === value.toLowerCase())
        ?? Array.from(sel.options).find((o) => o.text.toLowerCase().includes(value.toLowerCase()));
      if (opt) { sel.value = opt.value; sel.dispatchEvent(new Event("change", { bubbles: true })); n++; }
    } else if (tag === "input" && type === "checkbox") {
      const yes = /^(yes|true|1|agree|accept|acknowledge|confirm)/i.test(value);
      if (yes && !(el as HTMLInputElement).checked) { (el as HTMLInputElement).click(); n++; }
    } else if (tag === "input" && type === "radio") {
      // value matches this radio's own label
      if (labelFor(el).toLowerCase() === value.toLowerCase() || labelFor(el).toLowerCase().includes(value.toLowerCase())) {
        if (!(el as HTMLInputElement).checked) { (el as HTMLInputElement).click(); n++; }
      }
    }
  }

  // contenteditable rich-text editors
  for (const el of editables()) {
    const value = byLabel.get(labelFor(el).toLowerCase());
    if (value) { setEditable(el, value); n++; }
  }
  return n;
}
