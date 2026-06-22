import { solveHcaptcha } from "./captcha";
import type { SubmitContext } from "./input";

// Pure-HTTP Lever submitter — no browser. Lever serves a real server-rendered
// multipart form, so we parse it, map the candidate's profile + AI answers onto
// the fields (including custom "cards"), solve the hCaptcha via CapSolver, and POST
// the application exactly as the browser would. This is the Tsenta-style approach.

type CardField = { idx: number; id: string; text: string; type: string; required: boolean; options: string[] };
type Card = { id: string; fields: CardField[] };
type LeverForm = { accountId: string | null; hcaptchaSitekey: string | null; cards: Card[]; defaults: { name: string; value: string }[] };

// Every named input/textarea on the form, with its current (decoded) value. Lever
// validates the whole form, so we must echo these back (baseTemplate JSON, surveyId,
// accountId, origin, etc.) — sending only our answers gets a 400.
function extractDefaults(html: string): { name: string; value: string }[] {
  const form = html.slice(html.indexOf("application-form"));
  const out: { name: string; value: string }[] = [];
  const re = /<input\b[^>]*\bname="([^"]+)"[^>]*>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(form))) {
    const tag = m[0];
    const name = m[1];
    const type = (tag.match(/\btype="([^"]+)"/) ?? [])[1] ?? "text";
    if (type === "file" || type === "radio" || type === "checkbox" || !name) continue; // set/skipped separately
    const value = (tag.match(/\bvalue="([^"]*)"/) ?? [])[1] ?? "";
    out.push({ name, value: decodeEntities(value) });
  }
  return out;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&quot;/g, '"').replace(/&#34;/g, '"')
    .replace(/&#39;/g, "'").replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, "&");
}

export function parseLeverForm(html: string): LeverForm {
  const accountId = html.match(/name="accountId"\s+value="([^"]+)"|value="([^"]+)"\s+name="accountId"/)?.slice(1).find(Boolean) ?? null;
  const hcaptchaSitekey = html.match(/data-sitekey="([^"]+)"/)?.[1] ?? html.match(/"sitekey"\s*:\s*"([a-f0-9-]{20,})"/i)?.[1] ?? null;

  // Each custom card carries a baseTemplate=JSON with its ordered fields.
  const cards: Card[] = [];
  const re = /value="(\{[^"]*?&quot;fields&quot;[^"]*?\})"\s+name="cards\[([^\]]+)\]\[baseTemplate\]"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    try {
      const def = JSON.parse(decodeEntities(m[1])) as { fields?: { type?: string; text?: string; required?: boolean; id?: string; options?: ({ text?: string } | string)[] }[] };
      const cardId = m[2];
      const fields: CardField[] = (def.fields ?? []).map((f, idx) => ({
        idx,
        id: f.id ?? String(idx),
        text: f.text ?? "",
        type: f.type ?? "text",
        required: !!f.required,
        options: (f.options ?? []).map((o) => (typeof o === "string" ? o : o.text ?? "")).filter(Boolean),
      }));
      cards.push({ id: cardId, fields });
    } catch {
      /* skip a card we cannot parse */
    }
  }
  return { accountId, hcaptchaSitekey, cards, defaults: extractDefaults(html) };
}

type FillResult = { result: "submitted" | "needs_user" | "failed"; reason?: string };

export async function submitLever(ctx: SubmitContext, opts: { dryRun?: boolean } = {}): Promise<FillResult> {
  const applyUrl = /\/apply$/.test(ctx.applyUrl) ? ctx.applyUrl : `${ctx.applyUrl.replace(/\/$/, "")}/apply`;

  // 1) GET the apply page (keep cookies for the POST).
  const getRes = await fetch(applyUrl, { headers: { "User-Agent": "Mozilla/5.0", Accept: "text/html" } });
  if (!getRes.ok) return { result: "failed", reason: `lever apply page HTTP ${getRes.status}` };
  const cookie = (getRes.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");
  const html = await getRes.text();
  const form = parseLeverForm(html);

  // 2) Answer the custom-card questions from the profile.
  const questions = form.cards.flatMap((c) =>
    c.fields.filter((f) => f.required || f.options.length).map((f) => ({
      qid: `${c.id}__${f.idx}`,
      label: f.text,
      type: f.options.length ? "select" : f.type.includes("textarea") ? "textarea" : "text",
      options: f.options.length ? f.options : undefined,
    })),
  );
  const answers = questions.length
    ? await ctx.requestAnswers(questions.map((q) => ({ id: q.qid, label: q.label, type: q.type, options: q.options })))
    : {};

  // 3) Build the multipart body exactly like the browser form. Seed EVERY field
  // the form already carries (baseTemplate JSON, surveyId, accountId, origin, …) so
  // Lever's whole-form validation passes, then override with the candidate's data.
  const fd = new FormData();
  for (const d of form.defaults) fd.set(d.name, d.value);
  const fullName = [ctx.fields.firstName, ctx.fields.lastName].filter(Boolean).join(" ").trim();
  fd.set("name", fullName);
  fd.set("email", ctx.fields.email);
  if (ctx.fields.phone) fd.set("phone", ctx.fields.phone);
  if (ctx.fields.linkedin) fd.set("urls[LinkedIn]", ctx.fields.linkedin);
  if (ctx.fields.github) fd.set("urls[GitHub]", ctx.fields.github);
  if (ctx.fields.portfolio) fd.set("urls[Portfolio]", ctx.fields.portfolio);
  if (form.accountId) fd.set("accountId", form.accountId);
  fd.set("origin", "applied");
  if (ctx.coverLetter) fd.set("comments", ctx.coverLetter);
  if (ctx.resumeBase64) {
    fd.set("resume", new Blob([Buffer.from(ctx.resumeBase64, "base64")], { type: "application/pdf" }), ctx.resumeName);
  }
  for (const q of questions) {
    const v = answers[q.qid];
    if (v) fd.set(`cards[${q.qid.split("__")[0]}][field${q.qid.split("__")[1]}]`, v);
  }

  // 4) Solve the hCaptcha.
  let captchaToken: string | null = null;
  if (form.hcaptchaSitekey) {
    console.log(`[lever] solving hCaptcha (${form.hcaptchaSitekey.slice(0, 10)}…)`);
    captchaToken = await solveHcaptcha({ sitekey: form.hcaptchaSitekey, url: applyUrl });
    if (!captchaToken) return { result: "needs_user", reason: "could not solve the hCaptcha (check CAPSOLVER_API_KEY / balance)" };
    fd.set("h-captcha-response", captchaToken);
    fd.set("g-recaptcha-response", captchaToken);
  }

  const filledQ = questions.filter((q) => answers[q.qid]).length;
  console.log(`[lever] prepared: name=${!!fullName} email=${!!ctx.fields.email} resume=${!!ctx.resumeBase64} cards=${filledQ}/${questions.length} captcha=${!!captchaToken}`);

  if (opts.dryRun) {
    return { result: "needs_user", reason: `dry run: prepared ${filledQ}/${questions.length} card answers, captcha=${!!captchaToken}, accountId=${!!form.accountId}` };
  }

  // 5) POST the application.
  const postRes = await fetch(applyUrl, {
    method: "POST",
    headers: { "User-Agent": "Mozilla/5.0", Origin: "https://jobs.lever.co", Referer: applyUrl, ...(cookie ? { Cookie: cookie } : {}) },
    body: fd,
    redirect: "manual",
  });
  const status = postRes.status;
  const text = await postRes.text().catch(() => "");
  console.log(`[lever] POST -> HTTP ${status}`);

  // Lever returns 200 JSON {status:"ok"} / an applicationId, or 302 to /thanks.
  const loc = postRes.headers.get("location") ?? "";
  if (status === 200 && /"ok"|applicationId|thank/i.test(text)) return { result: "submitted" };
  if ((status === 302 || status === 303) && /thank|confirm|complete/i.test(loc)) return { result: "submitted" };
  if (status === 200 && text.length < 5) return { result: "submitted" }; // empty 200 body = accepted
  return { result: "needs_user", reason: `lever submit not confirmed (HTTP ${status}${loc ? `, ->${loc}` : ""}): ${text.slice(0, 160)}` };
}
