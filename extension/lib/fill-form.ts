// Shared, DOM-driven form filler used by every ATS content script. The pure
// field classification lives in greenhouse-map.ts; this module handles the DOM:
// reading fields, typing values, attaching the résumé, asking the server to
// answer any custom questions, and submitting. Per-ATS scripts pass submit hints
// and a requestAnswers callback (which round-trips through the background).
import { classifyField, valueForRole, type FillData } from "./greenhouse-map";

export type SubmitResult = "submitted" | "needs_user" | "failed";

export type QuestionType = "text" | "textarea" | "select" | "radio" | "checkbox";
export type FormQuestion = { id: string; label: string; type: QuestionType; options?: string[] };

export type FillInput = {
  fields: FillData;
  coverLetter: string;
  answers: Record<string, string>;
  resumeBase64: string | null;
  resumeName: string;
};

export type FillOptions = {
  submitSelectors: string[]; // tried in order first
  submitTextRe: RegExp; // fallback: a <button> whose text matches
  // Ask the server (via the background) to answer custom questions. Returns a
  // map of questionId -> answer. Omitted in tests.
  requestAnswers?: (questions: FormQuestion[]) => Promise<Record<string, string>>;
};

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
const actionDelay = () => 400 + Math.floor(Math.random() * 900); // human-ish pacing

export function labelFor(el: HTMLElement): string {
  const id = el.getAttribute("id");
  if (id) {
    const lab = document.querySelector(`label[for="${CSS.escape(id)}"]`);
    if (lab?.textContent) return lab.textContent.trim();
  }
  const labelledby = el.getAttribute("aria-labelledby");
  if (labelledby) {
    const txt = labelledby
      .split(/\s+/)
      .map((i) => document.getElementById(i)?.textContent ?? "")
      .join(" ")
      .trim();
    if (txt) return txt;
  }
  const wrap = el.closest("label");
  if (wrap?.textContent) return wrap.textContent.trim();
  return (el.getAttribute("aria-label") ?? "").trim();
}

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

function isVisible(el: HTMLElement): boolean {
  return el.offsetParent !== null;
}
function isRequired(el: Element): boolean {
  return (el as HTMLInputElement).required || el.getAttribute("aria-required") === "true";
}

// Fill a single answered control by question id.
function applyAnswer(el: HTMLElement, type: QuestionType, value: string) {
  if (!value) return;
  if (type === "text" || type === "textarea") {
    setNativeValue(el as HTMLInputElement, value);
  } else if (type === "select") {
    const sel = el as HTMLSelectElement;
    const want = value.toLowerCase();
    const opt = Array.from(sel.options).find(
      (o) => o.text.toLowerCase() === want || o.value.toLowerCase() === want || o.text.toLowerCase().includes(want),
    );
    if (opt) {
      sel.value = opt.value;
      sel.dispatchEvent(new Event("change", { bubbles: true }));
    }
  } else if (type === "checkbox") {
    const box = el as HTMLInputElement;
    const yes = /^(yes|true|1|i agree|agree|accept)/i.test(value);
    if (yes !== box.checked) box.click();
  }
}

function applyRadio(name: string, value: string) {
  const radios = Array.from(document.querySelectorAll<HTMLInputElement>(`input[type=radio][name="${CSS.escape(name)}"]`));
  const want = value.toLowerCase();
  const pick =
    radios.find((r) => labelFor(r).toLowerCase() === want || r.value.toLowerCase() === want) ??
    radios.find((r) => labelFor(r).toLowerCase().includes(want) || r.value.toLowerCase().includes(want));
  if (pick) pick.click();
}

export async function fillAndSubmit(input: FillInput, opts: FillOptions): Promise<{ result: SubmitResult; reason?: string }> {
  await waitForForm();

  const data: FillData = input.fields;
  const textInputs = Array.from(
    document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("input, textarea"),
  ).filter((el) => el.type !== "hidden" && (el.type === "file" || isVisible(el)));
  console.log(`[sasa] found ${textInputs.length} text field(s)`);

  let resumeAttached = false;
  const filled: string[] = [];

  // Question collection (unmapped required controls we will ask the server about).
  const questions: FormQuestion[] = [];
  const qref: Record<string, { el: HTMLElement; type: QuestionType; name?: string }> = {};
  const radioGroupsSeen = new Set<string>();
  let qi = 0;
  const addQuestion = (el: HTMLElement, type: QuestionType, options?: string[], name?: string) => {
    const id = `q${qi++}`;
    questions.push({ id, label: labelFor(el).slice(0, 200) || el.getAttribute("name") || "Question", type, options });
    qref[id] = { el, type, name };
  };

  // Pass 1: known text fields, résumé, cover letter; collect unmapped required text/textarea.
  for (const el of textInputs) {
    const meta = {
      name: el.getAttribute("name") ?? "",
      id: el.id,
      label: labelFor(el),
      type: el.type,
      placeholder: (el as HTMLInputElement).placeholder,
    };
    const role = classifyField(meta);

    if (role === "resume") {
      if (input.resumeBase64) {
        const file = base64ToFile(input.resumeBase64, input.resumeName);
        const dt = new DataTransfer();
        dt.items.add(file);
        (el as HTMLInputElement).files = dt.files;
        el.dispatchEvent(new Event("change", { bubbles: true }));
        resumeAttached = true;
      }
      continue;
    }
    if (role === "coverLetter") {
      if (el instanceof HTMLTextAreaElement) {
        setNativeValue(el, input.coverLetter);
        filled.push("coverLetter");
      }
      continue;
    }
    const value = valueForRole(role, data);
    if (value !== null && value !== "") {
      setNativeValue(el, value);
      filled.push(role as string);
      await delay(actionDelay());
      continue;
    }
    const type = el.type;
    if (type === "checkbox") {
      if (isRequired(el)) addQuestion(el, "checkbox");
    } else if (type === "radio") {
      const name = el.getAttribute("name") ?? "";
      if (name && !radioGroupsSeen.has(name) && isRequired(el)) {
        radioGroupsSeen.add(name);
        const group = Array.from(document.querySelectorAll<HTMLInputElement>(`input[type=radio][name="${CSS.escape(name)}"]`));
        addQuestion(el, "radio", group.map((r) => labelFor(r) || r.value).filter(Boolean), name);
      }
    } else if (role === null && isRequired(el)) {
      addQuestion(el, el instanceof HTMLTextAreaElement ? "textarea" : "text");
    }
  }

  // Selects (not covered by the text query).
  for (const sel of Array.from(document.querySelectorAll<HTMLSelectElement>("select")).filter(isVisible)) {
    if (!isRequired(sel) || sel.value) continue;
    addQuestion(sel, "select", Array.from(sel.options).map((o) => o.text.trim()).filter(Boolean));
  }

  console.log(`[sasa] filled: ${filled.join(", ") || "nothing"}. resume: ${resumeAttached}. custom questions: ${questions.length}.`);

  // Auto-answer custom questions via the server, then fill them.
  if (questions.length > 0 && opts.requestAnswers) {
    try {
      console.log("[sasa] requesting answers for:", questions.map((q) => q.label));
      const answers = await opts.requestAnswers(questions);
      for (const q of questions) {
        const value = answers[q.id];
        if (!value) continue;
        const ref = qref[q.id];
        if (q.type === "radio" && ref.name) applyRadio(ref.name, value);
        else applyAnswer(ref.el, q.type, value);
        await delay(actionDelay());
      }
    } catch (e) {
      console.warn("[sasa] answer generation failed:", e);
    }
  }

  // Re-check: anything required still empty after answering?
  const stillEmpty = questions
    .map((q) => qref[q.id])
    .filter((ref) => {
      if (ref.type === "checkbox") return isRequired(ref.el) && !(ref.el as HTMLInputElement).checked;
      if (ref.type === "radio" && ref.name)
        return !document.querySelector(`input[type=radio][name="${CSS.escape(ref.name)}"]:checked`);
      const v = (ref.el as HTMLInputElement | HTMLSelectElement).value;
      return !v;
    });

  if (stillEmpty.length > 0) {
    const labels = stillEmpty.map((r) => labelFor(r.el) || "a question").slice(0, 4);
    const reason = `could not answer required field(s): ${labels.join("; ")}`;
    console.warn(`[sasa] ${reason}`);
    return { result: "needs_user", reason };
  }
  if (!resumeAttached && input.resumeBase64) {
    return { result: "needs_user", reason: "could not attach resume" };
  }

  const submit =
    opts.submitSelectors
      .map((s) => document.querySelector<HTMLButtonElement>(s))
      .find((b): b is HTMLButtonElement => !!b) ??
    Array.from(document.querySelectorAll("button")).find((b) => opts.submitTextRe.test(b.textContent ?? ""));
  if (!submit) {
    return { result: "needs_user", reason: "no submit button found" };
  }

  console.log("[sasa] clicking submit");
  await delay(actionDelay());
  submit.click();
  await delay(3000);
  return { result: "submitted" };
}
