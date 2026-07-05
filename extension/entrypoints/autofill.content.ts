import { defineContentScript } from "wxt/utils/define-content-script";
import { fillAndSubmit } from "@/lib/fill-form";
import type { FillData } from "@/lib/greenhouse-map";
import { scanQuestions, applyAnswers, type ScannedQuestion } from "@/lib/questions";
import { scanContact } from "@/lib/contact";

type SuggestedQuestion = ScannedQuestion & { answer: string };
type SuggestResp = { ok: true; questions: SuggestedQuestion[] } | { ok: false; error: string };
type DraftedMessage = { to: string; kind: "email" | "dm"; subject: string; body: string };
type DraftResp = { ok: true; data: DraftedMessage } | { ok: false; error: string };

// Universal autofill. The script runs in EVERY frame (career pages often embed the
// application form in an iframe). Only the top frame shows the Sasa widget; when the
// user clicks it, we fetch their data once and broadcast a "fill" to all frames, so
// whichever frame holds the real form gets filled. We only PREFILL (never auto
// submit) on arbitrary pages — the user reviews and submits.

type FillInputMsg = { fields: FillData; coverLetter: string; answers: Record<string, string>; resumeBase64: string | null; resumeName: string };
type PrefillData = { connected: boolean; fields?: FillData; resumeBase64?: string | null; resumeName?: string };
type TailorQueued = { ok: true; applicationId: string } | { ok: false; error: string };
type TailorResultMsg = ({ ready: true } & FillInputMsg) | { ready: false; blocked?: boolean; message?: string } | null;
type TailorLookupMsg = { found: false } | { found: true; applicationId: string; ready: boolean; state: string };

// Pure ATS / job-board hosts — these exist only to post/host jobs, so always show.
const ATS_HOST_RE = /(greenhouse|lever\.co|ashbyhq|ashby|workable|smartrecruiters|myworkdayjobs|bamboohr|teamtailor|recruitee|breezy|jazzhr|jobvite|icims|taleo|successfactors|join\.com|personio|pinpointhq|myjobmag|jobberman|weworkremotely|remoteok|wellfound|otta|eightfold|dayforcehcm|jobs\.gem\.com)/i;

// Decide whether to show the widget. Precision matters: a stray appearance on every
// login / newsletter / shopping page is worse than missing the odd job page. So we
// only show on a pure ATS host, a schema.org JobPosting, a resume upload, or when at
// least TWO independent job signals agree.
function looksLikeJobPage(): boolean {
  const host = location.hostname;
  if (ATS_HOST_RE.test(host)) return true;

  const norm = (s?: string | null) => (s ?? "").replace(/\s+/g, " ").trim().toLowerCase();

  // schema.org JobPosting structured data is definitive.
  for (const s of Array.from(document.querySelectorAll('script[type="application/ld+json"]'))) {
    if (/"@type"\s*:\s*"JobPosting"/i.test(s.textContent || "")) return true;
  }

  // A resume/CV file upload is a strong, on-its-own signal of an application form.
  const resumeUpload = Array.from(document.querySelectorAll<HTMLInputElement>('input[type="file"]')).some((el) => {
    const ctx = norm(`${el.getAttribute("name") || ""} ${el.id} ${el.getAttribute("accept") || ""} ${el.closest("label,div,section,fieldset,form")?.textContent || ""}`).slice(0, 300);
    return /resume|cv\b|curriculum vitae/.test(ctx);
  });
  if (resumeUpload) return true;

  // Otherwise require at least two independent signals.
  let signals = 0;

  // A careers/jobs subdomain (careers.acme.com, jobs.acme.com, apply.acme.com…).
  if (/^(careers?|jobs?|apply|boards|talent|join|work)\./i.test(host)) signals++;

  // A job-ish path segment (not just the word somewhere in the query string).
  if (/\/(jobs?|careers?|positions?|vacanc(y|ies)|openings?|apply|job-application|job_application|viewjob)(\/|$|[?#])/i.test(location.pathname)) signals++;

  // A specific "apply for this job" button (not a generic "apply filters").
  const applyBtn = Array.from(document.querySelectorAll("a,button,[role='button']")).some((el) => {
    const x = norm(el.textContent);
    if (!x || x.length > 40) return false;
    return x === "apply" || /apply now|apply for (this )?(job|role|position)|submit (your )?application|easy apply|i.?m interested in this/.test(x);
  });
  if (applyBtn) signals++;

  // Structured job-posting headings.
  const heads = Array.from(document.querySelectorAll("h1,h2,h3,[role='heading']")).map((h) => norm(h.textContent));
  if (heads.some((h) => /responsibilit|qualification|requirements?\b|what you.?ll do|who you are|about (the|this) role|job description|minimum qualif|preferred qualif|what we.?re looking for/.test(h))) signals++;

  return signals >= 2;
}

const clean = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim();
const isVisible = (el: Element) => !!(el as HTMLElement).offsetParent || getComputedStyle(el).position === "fixed";

// On master-detail pages (a list of jobs on the left, the selected job's detail on
// the right, e.g. Workable / LinkedIn search) the page <h1> and document.title name
// the search, not the selected role. The reliable anchor is the Apply button: the
// active job's title and description live in the same pane as "Apply". We climb from
// the Apply button to the nearest ancestor that holds a heading, and treat that pane
// as the active job. Falls back to the whole document when there's no Apply button.
function activePane(): HTMLElement | null {
  const controls = Array.from(document.querySelectorAll<HTMLElement>("a,button,[role='button']")).filter(isVisible);
  const apply = controls.find((b) => {
    const t = clean(b.textContent).toLowerCase();
    return t.length <= 28 && /\bapply\b|submit application|apply now|apply for/.test(t);
  });
  let node: HTMLElement | null = apply ?? null;
  while (node && node !== document.body) {
    if (node.querySelector?.("h1,h2,[role='heading']")) return node;
    node = node.parentElement;
  }
  return null;
}

function headingIn(scope: ParentNode): string {
  for (const sel of ["h1", "h2", "[role='heading'][aria-level='1']", "[role='heading']"]) {
    for (const h of Array.from(scope.querySelectorAll<HTMLElement>(sel))) {
      const t = clean(h.textContent);
      if (isVisible(h) && t.length >= 3 && t.length <= 160 && !/\bjobs?\b.*[|·]/i.test(t)) return t;
    }
  }
  return "";
}

function companyIn(scope: ParentNode, fallback: string): string {
  for (const a of Array.from(scope.querySelectorAll<HTMLAnchorElement>("a"))) {
    const t = clean(a.textContent);
    if (t && t.length >= 2 && t.length <= 60 && !/^https?:/i.test(t) && !/\b(apply|share|save|log ?in|sign ?up|back|home|view|more|report)\b/i.test(t)) {
      return t;
    }
  }
  return fallback;
}

// Detect the active job's title + company. Light enough to poll for the label.
function detectActive(): { title: string; company: string } {
  const meta = (n: string) => document.querySelector<HTMLMetaElement>(`meta[property="${n}"], meta[name="${n}"]`)?.content || "";
  const host = (() => { try { return new URL(location.href).hostname.replace(/^www\./, ""); } catch { return ""; } })();
  const pane = activePane();
  let title = pane ? headingIn(pane) : "";
  if (!title) title = clean(document.querySelector("h1")?.textContent) || meta("og:title") || clean(document.title);
  const company = pane ? companyIn(pane, meta("og:site_name") || host) : (meta("og:site_name") || host);
  return { title: title.slice(0, 200), company };
}

// Scan the page for the role's details. Career pages vary: some show the job
// description on a hidden "Overview" tab, some put the form in an iframe. We read
// textContent (which includes hidden tabs, unlike innerText) from the containers
// most likely to hold the description, dedupe, and fall back to the visible text.
// On master-detail pages we scope the description to the active pane so tailoring
// uses the selected job, not every job on the page.
function scrapeJob() {
  const { title, company } = detectActive();
  const pane = activePane();
  if (pane) {
    const paneText = clean(pane.textContent);
    if (paneText.length >= 400) return { title, company, jd: paneText.slice(0, 12000), url: location.href };
  }

  const selectors = [
    '[class*="description" i]', '[id*="description" i]',
    '[class*="overview" i]', '[id*="overview" i]',
    '[class*="responsibilit" i]', '[class*="qualification" i]', '[class*="requirement" i]',
    '[class*="job" i]', '[class*="role" i]', '[class*="posting" i]', '[class*="vacancy" i]',
    "article", "main", '[role="main"]', "section",
  ];
  const chunks: string[] = [];
  const seen = new Set<string>();
  for (const sel of selectors) {
    document.querySelectorAll<HTMLElement>(sel).forEach((el) => {
      const t = (el.textContent || "").replace(/\s+/g, " ").trim();
      const key = t.slice(0, 80);
      if (t.length > 200 && !seen.has(key)) { seen.add(key); chunks.push(t); }
    });
  }
  let jd = chunks.join("\n\n");
  // Fallback to visible text if the targeted scan found little.
  if (jd.length < 400) jd = (document.body.innerText || "").replace(/\s+\n/g, "\n").trim();
  jd = jd.slice(0, 12000);

  return { title, company, jd, url: location.href };
}

export default defineContentScript({
  matches: ["https://*/*"],
  allFrames: true,
  runAt: "document_idle",
  main() {
    // Every frame: fill broadcasts, question scans, and answer applies (the form
    // may live in an iframe, so all frames participate).
    chrome.runtime.onMessage.addListener((msg: { type?: string; input?: FillInputMsg; answers?: Record<string, string> }, _sender, sendResponse) => {
      if (msg?.type === "sasaFill" && msg.input) {
        fillAndSubmit(msg.input, { submitSelectors: [], submitTextRe: /apply|submit/i, noSubmit: true })
          .then(sendResponse)
          .catch(() => sendResponse({ result: "failed" }));
        return true; // async
      }
      if (msg?.type === "sasaScan") {
        sendResponse(scanQuestions());
        return false;
      }
      if (msg?.type === "sasaApply" && msg.answers) {
        sendResponse({ filled: applyAnswers(msg.answers) });
        return false;
      }
      return undefined;
    });

    // Only the top frame renders the widget.
    if (window.top !== window.self) return;
    const host = location.hostname;
    // On our own app: don't render the widget, but if a DIFFERENT user is now signed
    // in than the one the extension is paired to, disconnect it so it asks for a fresh
    // token for this account (no stale stats from the previous user).
    if (/(^|\.)usesasa\.xyz$/.test(host) || host === "localhost") {
      void (async () => {
        try {
          const meta = document.querySelector('meta[name="sasa-user"]')?.getAttribute("content") || "";
          const { token, pairedUser } = await chrome.storage.local.get(["token", "pairedUser"]);
          if (token && pairedUser && meta && meta !== pairedUser) {
            await chrome.storage.local.remove(["token", "pairedUser", "autoSubmit"]);
          }
        } catch { /* ignore */ }
      })();
      return;
    }
    // NOTE: greenhouse/lever/ashby also have a dedicated script, but it's a passive
    // listener for the queued-application fill flow (no UI). The universal widget still
    // mounts here so the user gets match score / tailor / suggest on ATS posting pages.
    // The scripts use different message types, so they don't collide.

    // Always mount, but start MINIMIZED (a small bubble) on pages that don't look
    // like a job page. On a detected job page it auto-expands. The user can drag the
    // bubble anywhere and open it manually if a job page slips past detection.
    mountWidget();
  },
});

// Broadcast a fill payload to every frame in this tab (via the background worker).
async function broadcastFill(input: FillInputMsg) {
  await chrome.runtime.sendMessage({ type: "broadcastFill", input });
}

function downloadBlob(blob: Blob, filename: string) {
  const u = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = u;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(u), 2000);
}
function downloadBase64Pdf(b64: string, name: string) {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  downloadBlob(new Blob([arr], { type: "application/pdf" }), name);
}

// Poll the background for the queued tailor result (~90s), then give up gracefully
// (the worker still finishes and notifies via Telegram/email).
async function pollTailor(id: string): Promise<TailorResultMsg> {
  for (let i = 0; i < 30; i++) {
    const r = (await chrome.runtime.sendMessage({ type: "tailorResult", id })) as TailorResultMsg;
    if (r && (r.ready || ("blocked" in r && r.blocked))) return r;
    await new Promise((res) => setTimeout(res, 3000));
  }
  return null;
}

// The Sasa brand mark (the arrow ↗). A dark rounded tile for the light card header,
// and a plain light arrow for the dark bubble.
const LOGO_TILE = `<svg class="logo" width="18" height="18" viewBox="0 0 512 512" fill="none" aria-hidden="true"><rect x="16" y="16" width="480" height="480" rx="120" fill="#11271f"/><g stroke="#fff" stroke-width="46" stroke-linecap="round" stroke-linejoin="round"><path d="M180 332 L320 192"/><path d="M256 192 L320 192 L320 256"/></g></svg>`;
const LOGO_LIGHT = `<svg width="16" height="16" viewBox="0 0 512 512" fill="none" aria-hidden="true"><g stroke="#fff" stroke-width="52" stroke-linecap="round" stroke-linejoin="round"><path d="M150 350 L330 170"/><path d="M252 170 L330 170 L330 248"/></g></svg>`;

function mountWidget() {
  const root = document.createElement("div");
  root.id = "sasa-autofill-root";
  // Default to the middle of the right edge (out of the way of the bottom-right chat
  // widgets many sites use). The user can drag it anywhere; we remember where.
  root.style.cssText = "position:fixed;top:50%;right:20px;transform:translateY(-50%);z-index:2147483647;";
  const shadow = root.attachShadow({ mode: "open" });

  const style = document.createElement("style");
  style.textContent = `
    .card { font: 500 13px ui-sans-serif, system-ui, sans-serif; background:#fff; border:1px solid rgba(0,0,0,.08);
      border-radius:14px; padding:12px; box-shadow:0 8px 30px rgba(0,0,0,.16); width:300px; max-height:80vh; overflow:auto; }
    .head { display:flex; align-items:center; gap:7px; color:#11271f; font-weight:600; margin-bottom:6px; cursor:move; user-select:none; touch-action:none; }
    .grip { margin-left:auto; color:#9aa5a0; font-size:14px; letter-spacing:1px; }
    .min { width:22px; height:22px; margin-top:0; padding:0; line-height:20px; text-align:center; border:none; border-radius:6px;
      background:transparent; color:#9aa5a0; font-size:17px; cursor:pointer; }
    .min:hover { background:rgba(0,0,0,.06); color:#11271f; }
    .bubble { display:none; align-items:center; gap:7px; background:#11271f; color:#fff; border-radius:9999px; padding:9px 13px;
      box-shadow:0 8px 30px rgba(0,0,0,.22); cursor:pointer; font:600 12px ui-sans-serif, system-ui, sans-serif; }
    .dot { width:8px; height:8px; border-radius:9999px; background:#22c55e; }
    .job { font-size:11px; color:#5b6660; margin-bottom:9px; line-height:1.35; }
    .job b { color:#11271f; font-weight:600; }
    .score { margin-bottom:10px; min-height:0; }
    .score.loading { font-size:11px; color:#7c8782; }
    .scrow { display:flex; align-items:center; gap:10px; }
    .scd { display:flex; flex-direction:column; gap:1px; min-width:0; }
    .scd b { font-size:12px; color:#11271f; }
    .scd .rsn { font-size:10.5px; color:#5b6660; line-height:1.3; }
    .toggle { display:flex; align-items:center; gap:7px; font-size:11px; color:#5b6660; margin:8px 2px 4px; cursor:pointer; user-select:none; }
    .toggle input { width:13px; height:13px; accent-color:#16a34a; cursor:pointer; }
    .toggle span { line-height:1.3; }
    button { width:100%; font:500 13px ui-sans-serif, system-ui, sans-serif; border-radius:9px; padding:9px 12px;
      cursor:pointer; border:none; margin-top:6px; }
    .primary { color:#fff; background:#11271f; } .primary:hover { background:#1c3a2e; }
    .ghost { color:#11271f; background:transparent; border:1px solid rgba(0,0,0,.15); } .ghost:hover { border-color:rgba(0,0,0,.4); }
    button:disabled { opacity:.6; cursor:default; }
    .status { margin-top:8px; font-size:12px; color:#5b6660; min-height:14px; }
    .q { margin-top:9px; }
    .qlabel { font-size:11px; color:#5b6660; margin-bottom:3px; }
    .qa { width:100%; box-sizing:border-box; border:1px solid rgba(0,0,0,.15); border-radius:8px; padding:6px 8px;
      font:13px ui-sans-serif, system-ui; resize:vertical; }
  `;
  const card = document.createElement("div");
  card.className = "card";
  card.innerHTML = `
    <div class="head" id="head">${LOGO_TILE}Sasa<span class="grip">⠿</span><button class="min" id="min" title="Minimize" aria-label="Minimize">–</button></div>
    <div class="job" id="job"></div>
    <div class="score" id="score"></div>
    <button class="primary" id="tailor">Tailor to this job (1 credit)</button>
    <label class="toggle" id="embToggle" title="When on, Sasa may add job-relevant skills you did not list, woven into your real roles. When off, it stays strictly to what your CV says.">
      <input type="checkbox" id="emb"><span>Add relevant skills (honesty off)</span>
    </label>
    <button class="ghost" id="quick">Quick fill</button>
    <button class="ghost" id="suggest">Suggest answers</button>
    <button class="ghost" id="draft">Draft email / DM</button>
    <button class="ghost" id="markApplied">I applied, mark it (1 credit)</button>
    <div class="status" id="status"></div>
    <div id="results" style="display:flex;flex-direction:column;gap:6px;margin-top:8px;"></div>
    <div id="panel"></div>
  `;
  shadow.append(style, card);
  document.documentElement.appendChild(root);

  const statusEl = card.querySelector<HTMLDivElement>("#status")!;
  const tailorBtn = card.querySelector<HTMLButtonElement>("#tailor")!;
  const quickBtn = card.querySelector<HTMLButtonElement>("#quick")!;
  const suggestBtn = card.querySelector<HTMLButtonElement>("#suggest")!;
  const draftBtn = card.querySelector<HTMLButtonElement>("#draft")!;
  const markBtn = card.querySelector<HTMLButtonElement>("#markApplied")!;
  const resultsEl = card.querySelector<HTMLDivElement>("#results")!;
  const panelEl = card.querySelector<HTMLDivElement>("#panel")!;
  const embChk = card.querySelector<HTMLInputElement>("#emb")!;
  const embLabel = card.querySelector<HTMLSpanElement>("#embToggle span")!;
  const setStatus = (t: string) => (statusEl.textContent = t);

  // Honesty toggle: when ON, tailoring may add job-relevant skills the candidate did
  // not list (woven into real roles); when OFF, it stays strictly to the CV. The
  // choice persists across pages.
  const reflectEmb = () => { embLabel.textContent = embChk.checked ? "Add relevant skills (honesty off)" : "Strict to my CV (honesty on)"; };
  chrome.storage?.local.get("sasaEmbellish").then((s) => { embChk.checked = s?.sasaEmbellish === true; reflectEmb(); }).catch(() => reflectEmb());
  embChk.addEventListener("change", () => { reflectEmb(); chrome.storage?.local.set({ sasaEmbellish: embChk.checked }); });
  const busy = (on: boolean) => { tailorBtn.disabled = on; quickBtn.disabled = on; suggestBtn.disabled = on; draftBtn.disabled = on; markBtn.disabled = on; };

  // Show the detected job so the user can confirm the widget mapped the right one.
  // (Click to re-detect on SPA pages that swap the role without a reload.)
  const jobEl = card.querySelector<HTMLDivElement>("#job")!;
  const scoreEl = card.querySelector<HTMLDivElement>("#score")!;

  // Match ring: how well the open job fits the user's profile (0-100).
  const bandColor = (p: number) => (p >= 60 ? "#16a34a" : p >= 40 ? "#d97706" : "#dc2626");
  const renderScore = (pct: number, reason: string) => {
    const r = 18, circ = 2 * Math.PI * r, off = circ * (1 - Math.max(0, Math.min(100, pct)) / 100);
    scoreEl.className = "score";
    scoreEl.innerHTML = `<div class="scrow">
      <svg width="46" height="46" viewBox="0 0 46 46" aria-hidden="true">
        <circle cx="23" cy="23" r="${r}" fill="none" stroke="#e6eae8" stroke-width="5"></circle>
        <circle cx="23" cy="23" r="${r}" fill="none" stroke="${bandColor(pct)}" stroke-width="5" stroke-linecap="round" stroke-dasharray="${circ.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}" transform="rotate(-90 23 23)"></circle>
        <text x="23" y="27" text-anchor="middle" font-size="12" font-weight="700" fill="#11271f">${pct}%</text>
      </svg>
      <div class="scd"><b>${pct}% match</b><span class="rsn"></span></div>
    </div>`;
    const rsn = scoreEl.querySelector<HTMLSpanElement>(".rsn");
    if (rsn) rsn.textContent = reason || "";
  };

  let scoreToken = 0;
  let scoreTimer: ReturnType<typeof setTimeout> | undefined;
  const scoreActive = async () => {
    const token = ++scoreToken;
    const job = scrapeJob();
    if (!job.title) { scoreEl.textContent = ""; scoreEl.className = "score"; return; }
    scoreEl.className = "score loading"; scoreEl.textContent = "Checking match…";
    try {
      const resp = (await chrome.runtime.sendMessage({
        type: "matchScore",
        payload: { title: job.title, company: job.company, jd: job.jd, url: job.url },
      })) as { ok: true; data: { score: number; reason: string } } | { ok: false; error: string };
      if (token !== scoreToken) return; // a newer job superseded this request
      if (!resp?.ok) { scoreEl.className = "score loading"; scoreEl.textContent = /credit|onboarding|sasa/i.test(resp?.error || "") ? resp!.error : ""; return; }
      renderScore(resp.data.score, resp.data.reason);
    } catch { if (token === scoreToken) { scoreEl.textContent = ""; scoreEl.className = "score"; } }
  };

  let lastTitle = " ";
  const showJob = () => {
    const { title, company } = detectActive();
    if (title === lastTitle) return; // nothing changed — skip the DOM write
    lastTitle = title;
    jobEl.textContent = "";
    if (!title) { jobEl.textContent = "No job detected here — tailoring may be off."; scoreEl.textContent = ""; return; }
    jobEl.append(document.createTextNode("For: "));
    const b = document.createElement("b");
    b.textContent = title + (company ? ` · ${company}` : "");
    jobEl.append(b, document.createTextNode("  (click to refresh)"));
    // Score the newly active job (debounced so fast list-clicking scores once).
    clearTimeout(scoreTimer);
    scoreTimer = setTimeout(scoreActive, 500);
  };
  jobEl.title = "Click to re-detect the job on this page";
  jobEl.style.cursor = "pointer";
  jobEl.addEventListener("click", () => { lastTitle = " "; showJob(); });
  showJob();
  // Pick up the active job when the user selects a different one in a list, or the
  // SPA swaps the detail pane, without needing a manual refresh.
  setInterval(showJob, 1500);

  // Drag helper: a drag on the handle repositions the whole widget; a tap (no real
  // movement) fires onTap. Used by the card header and the collapsed bubble, so the
  // user can move either around the browser.
  const head = card.querySelector<HTMLDivElement>("#head")!;
  const enableDrag = (handle: HTMLElement, onTap?: () => void) => {
    let dragging = false, moved = false, sx = 0, sy = 0, bx = 0, by = 0;
    handle.addEventListener("pointerdown", (e) => {
      dragging = true; moved = false;
      const r = root.getBoundingClientRect();
      bx = r.left; by = r.top; sx = e.clientX; sy = e.clientY;
      // Pin to left/top and drop the centering transform so drag math is 1:1.
      root.style.left = `${bx}px`; root.style.top = `${by}px`; root.style.right = "auto"; root.style.bottom = "auto"; root.style.transform = "none";
      try { handle.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    });
    handle.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      if (Math.abs(e.clientX - sx) > 4 || Math.abs(e.clientY - sy) > 4) moved = true;
      const nx = Math.max(4, Math.min(window.innerWidth - 44, bx + (e.clientX - sx)));
      const ny = Math.max(4, Math.min(window.innerHeight - 44, by + (e.clientY - sy)));
      root.style.left = `${nx}px`; root.style.top = `${ny}px`;
    });
    const end = (e: PointerEvent) => {
      if (!dragging) return;
      dragging = false;
      try { handle.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
      if (moved) {
        // Remember where the user parked it, so it stays there on future pages.
        chrome.storage?.local.set({ sasaWidgetPos: { left: parseFloat(root.style.left) || 0, top: parseFloat(root.style.top) || 0 } }).catch(() => {});
      } else if (onTap) onTap();
    };
    handle.addEventListener("pointerup", end);
    handle.addEventListener("pointercancel", end);
  };
  enableDrag(head);

  // Restore a previously-dragged position (clamped to the current viewport).
  chrome.storage?.local.get("sasaWidgetPos").then((s) => {
    const p = s?.sasaWidgetPos as { left?: number; top?: number } | undefined;
    if (p && typeof p.left === "number" && typeof p.top === "number") {
      root.style.left = `${Math.max(4, Math.min(window.innerWidth - 44, p.left))}px`;
      root.style.top = `${Math.max(4, Math.min(window.innerHeight - 44, p.top))}px`;
      root.style.right = "auto"; root.style.bottom = "auto"; root.style.transform = "none";
    }
  }).catch(() => {});

  // Minimize / expand + the collapsed bubble. The minimized state is driven by
  // job-page detection until the user manually toggles it. On a job page it expands;
  // elsewhere it stays a small draggable bubble the user can tap open anytime.
  const minBtn = card.querySelector<HTMLButtonElement>("#min")!;
  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.title = "Open Sasa (drag to move)";
  bubble.innerHTML = `${LOGO_LIGHT}Sasa`;
  shadow.append(bubble);
  let userToggled = false;
  const setMinimized = (min: boolean) => {
    card.style.display = min ? "none" : "";
    bubble.style.display = min ? "flex" : "none";
  };
  minBtn.addEventListener("pointerdown", (e) => e.stopPropagation()); // don't start a drag
  minBtn.addEventListener("click", (e) => { e.stopPropagation(); userToggled = true; setMinimized(true); });
  enableDrag(bubble, () => { userToggled = true; setMinimized(false); });

  // Auto-decide minimized vs open from detection, until the user takes over. Re-check
  // for a while (boards render late) and reset the override on SPA navigation.
  const applyDetection = () => { if (!userToggled) setMinimized(!looksLikeJobPage()); };
  applyDetection();
  let detChecks = 0;
  const detIv = setInterval(() => { applyDetection(); if (++detChecks > 20) clearInterval(detIv); }, 1500);
  let lastDetUrl = location.href;
  setInterval(() => {
    if (location.href !== lastDetUrl) { lastDetUrl = location.href; userToggled = false; applyDetection(); }
  }, 1500);

  // Render a drafted email/DM with copy buttons (user copies + sends themselves).
  const renderDraft = (draft: DraftedMessage) => {
    panelEl.innerHTML = "";
    const copyRow = (label: string, value: string, rows = 1) => {
      const wrap = document.createElement("div");
      wrap.className = "q";
      const head = document.createElement("div");
      head.className = "qlabel";
      head.textContent = label;
      const ta = document.createElement("textarea");
      ta.className = "qa";
      ta.rows = rows;
      ta.value = value;
      const copy = document.createElement("button");
      copy.className = "ghost";
      copy.textContent = `Copy ${label.toLowerCase()}`;
      copy.addEventListener("click", async () => {
        try { await navigator.clipboard.writeText(ta.value); copy.textContent = "Copied"; setTimeout(() => (copy.textContent = `Copy ${label.toLowerCase()}`), 1500); } catch { /* blocked */ }
      });
      wrap.append(head, ta, copy);
      panelEl.appendChild(wrap);
    };
    copyRow(draft.kind === "dm" ? "To (DM)" : "To", draft.to, 1);
    if (draft.kind === "email" && draft.subject) copyRow("Subject", draft.subject, 1);
    copyRow("Message", draft.body, draft.kind === "dm" ? 4 : 8);
  };

  // Editable panel: scanned questions + suggested answers → apply to the form.
  const renderPanel = (questions: SuggestedQuestion[]) => {
    panelEl.innerHTML = "";
    const getters: { label: string; get: () => string }[] = [];
    for (const q of questions) {
      const wrap = document.createElement("div");
      wrap.className = "q";
      const lbl = document.createElement("div");
      lbl.className = "qlabel";
      lbl.textContent = q.options?.length ? `${q.label}  [${q.options.slice(0, 6).join(" / ")}]` : q.label;
      const ta = document.createElement("textarea");
      ta.className = "qa";
      ta.rows = q.type === "textarea" ? 3 : 1;
      ta.value = q.answer;
      wrap.append(lbl, ta);
      panelEl.appendChild(wrap);
      getters.push({ label: q.label, get: () => ta.value });
    }
    const apply = document.createElement("button");
    apply.className = "primary";
    apply.textContent = "Apply answers to form";
    apply.addEventListener("click", async () => {
      const answers: Record<string, string> = {};
      for (const g of getters) { const v = g.get().trim(); if (v) answers[g.label] = v; }
      apply.disabled = true; apply.textContent = "Applying…";
      await chrome.runtime.sendMessage({ type: "applyAnswers", answers });
      apply.textContent = "Applied. Review the form.";
    });
    panelEl.appendChild(apply);
  };

  suggestBtn.addEventListener("click", async () => {
    busy(true); panelEl.innerHTML = ""; setStatus("Scanning the form for questions…");
    try {
      const resp = (await chrome.runtime.sendMessage({ type: "suggestQuestions", context: scrapeJob() })) as SuggestResp;
      if (!resp?.ok) { setStatus(resp?.error || "Could not scan."); return; }
      if (resp.questions.length === 0) { setStatus("No questions found yet. Open the application form (click Apply), then try again."); return; }
      setStatus(`${resp.questions.length} question(s). Review, edit, then apply.`);
      renderPanel(resp.questions);
    } catch (e) { setStatus(`Could not scan: ${e instanceof Error ? e.message : "try again"}`); }
    finally { busy(false); }
  });

  draftBtn.addEventListener("click", async () => {
    busy(true); panelEl.innerHTML = ""; setStatus("Looking for an email or DM contact…");
    try {
      const c = scanContact();
      if (!c) { setStatus("No email or DM contact found on this page."); return; }
      setStatus(`Drafting a ${c.kind === "dm" ? "DM" : "message"} to ${c.value}…`);
      const job = scrapeJob();
      const resp = (await chrome.runtime.sendMessage({
        type: "draftMessage",
        payload: { title: job.title, company: job.company, jd: job.jd, contactKind: c.kind, contactValue: c.value },
      })) as DraftResp;
      if (!resp?.ok) { setStatus(resp?.error || "Could not draft."); return; }
      setStatus("Draft ready. Review, copy, and send it yourself.");
      renderDraft(resp.data);
    } catch { setStatus("Could not draft. Try again."); }
    finally { busy(false); }
  });

  // "I applied, mark it" — after the user fills/submits the form themselves, record
  // the role as applied so it shows on the dashboard (charges 1 credit).
  markBtn.addEventListener("click", async () => {
    const job = scrapeJob();
    const url = job.url || location.href;
    busy(true); setStatus("Marking as applied…");
    try {
      const resp = (await chrome.runtime.sendMessage({ type: "markApplied", payload: { title: job.title || "Role", company: job.company || "Company", url } })) as { ok: boolean; error?: string };
      if (resp?.ok) { setStatus("Marked as applied. It shows in your dashboard now."); markBtn.textContent = "Applied"; }
      else setStatus(resp?.error || "Could not mark applied.");
    } catch { setStatus("Could not mark applied. Try again."); }
    finally { busy(false); if (markBtn.textContent === "Applied") markBtn.disabled = true; }
  });

  // Render Download CV / Download cover / Fill once tailoring is ready.
  const renderResult = (r: { ready: true } & FillInputMsg) => {
    resultsEl.innerHTML = "";
    const mk = (label: string, cls: string, onClick: () => void) => {
      const b = document.createElement("button");
      b.className = cls;
      b.textContent = label;
      b.style.marginTop = "0";
      b.addEventListener("click", onClick);
      resultsEl.appendChild(b);
    };
    if (r.resumeBase64) mk("Download tailored CV", "primary", () => downloadBase64Pdf(r.resumeBase64!, r.resumeName || "cv.pdf"));
    if (r.coverLetter) mk("Download cover letter", "ghost", () => downloadBlob(new Blob([r.coverLetter], { type: "text/plain" }), "cover-letter.txt"));
    mk("Fill the form", "ghost", () => { void broadcastFill(r); });
  };

  quickBtn.addEventListener("click", async () => {
    busy(true); setStatus("Filling…");
    try {
      const data = (await chrome.runtime.sendMessage({ type: "prefillData" })) as PrefillData;
      if (!data?.connected || !data.fields) { setStatus("Open the Sasa popup to connect."); return; }
      await broadcastFill({ fields: data.fields, coverLetter: "", answers: {}, resumeBase64: data.resumeBase64 ?? null, resumeName: data.resumeName ?? "cv.pdf" });
      setStatus("Filled. Review and submit.");
    } catch { setStatus("Could not fill. Try again."); }
    finally { busy(false); }
  });

  tailorBtn.addEventListener("click", async () => {
    busy(true); resultsEl.innerHTML = ""; setStatus("Starting…");
    try {
      const q = (await chrome.runtime.sendMessage({ type: "tailorAdhoc", payload: { ...scrapeJob(), embellish: embChk.checked } })) as TailorQueued;
      if (!q?.ok) { setStatus(q?.error || "Could not start tailoring."); return; }
      setStatus("Tailoring… you can leave this page, we'll notify you when it's ready.");
      const r = await pollTailor(q.applicationId);
      if (!r) { setStatus("Still working. We'll notify you on Telegram/email; the docs will be in your dashboard."); return; }
      if (!r.ready) { setStatus(("message" in r && r.message) || "Could not tailor."); return; }
      setStatus("Tailored. Download your docs or fill the form.");
      renderResult(r);
    } catch { setStatus("Could not tailor. Try again."); }
    finally { busy(false); }
  });

  // On (re)visiting a page, check whether this exact job was already tailored. If so,
  // show the download/fill actions instead of letting the user re-tailor (and re-pay).
  // Re-runs when the active job's URL changes (SPA job lists).
  let lastLookupUrl = "";
  const checkExisting = async () => {
    const url = location.href;
    if (url === lastLookupUrl) return;
    lastLookupUrl = url;
    try {
      const look = (await chrome.runtime.sendMessage({ type: "tailorLookup", url })) as TailorLookupMsg;
      if (!look?.found) { resultsEl.innerHTML = ""; tailorBtn.textContent = "Tailor to this job (1 credit)"; return; }
      tailorBtn.textContent = "Re-tailor (1 credit)";
      if (look.ready) setStatus("Already tailored for this job. Download or fill below.");
      else setStatus("Tailoring this job is in progress. It will be ready shortly.");
      const r = await pollTailor(look.applicationId);
      if (r?.ready) { setStatus("Already tailored for this job. Download or fill below."); renderResult(r); }
    } catch { /* leave the default tailor flow available */ }
  };
  void checkExisting();
  setInterval(() => { void checkExisting(); }, 2000);
}
