import { defineBackground } from "wxt/utils/define-background";
import { getConfig } from "@/lib/config";
import { fetchQueue, report, answerQuestions, fetchProfile, tailorAdhoc, tailorResult, tailorLookup, suggestAnswers, draftMessage, matchScore, markApplied, type QueuedApp, type SubmitResult, type AnswerQuestion } from "@/lib/api";
import type { ScannedQuestion } from "@/lib/questions";

export type FillMessage = {
  type: "fill";
  app: QueuedApp;
  resumeBase64: string | null;
  resumeName: string;
};

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
const jitter = () => 8000 + Math.floor(Math.random() * 17000); // 8–25s between applications

function bufToBase64(buf: ArrayBuffer): string {
  let bin = "";
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function waitForComplete(tabId: number): Promise<void> {
  return new Promise((resolve) => {
    const listener = (id: number, info: chrome.tabs.TabChangeInfo) => {
      if (id === tabId && info.status === "complete") {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    };
    chrome.tabs.onUpdated.addListener(listener);
    setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      resolve();
    }, 20000);
  });
}

type RunResult = { result: SubmitResult; reason?: string };

async function runOnTab(app: QueuedApp, resumeBase64: string | null): Promise<RunResult> {
  if (!app.applyUrl) {
    console.warn(`[sasa] ${app.company}: no apply URL, skipping`);
    return { result: "needs_user", reason: "no application URL for this job" };
  }
  console.log(`[sasa] opening ${app.applyUrl} for ${app.company} (${app.title})`);
  // Open in the FOREGROUND. Chrome throttles background tabs (clamped timers,
  // paused rendering), which makes custom dropdown menus fail to open in time.
  // An active tab fills reliably; progress still shows on the toolbar badge.
  const tab = await chrome.tabs.create({ url: app.applyUrl, active: true });
  const tabId = tab.id;
  if (!tabId) {
    console.error(`[sasa] could not open a tab for ${app.company}`);
    return { result: "failed", reason: "could not open the application tab" };
  }
  await waitForComplete(tabId);
  await delay(2500); // let SPA boards render
  try {
    const msg: FillMessage = { type: "fill", app, resumeBase64, resumeName: `${app.fields.firstName || "cv"}.pdf` };
    const res = (await chrome.tabs.sendMessage(tabId, msg)) as { result?: SubmitResult; reason?: string } | undefined;
    console.log(`[sasa] ${app.company}: content script returned ${res?.result ?? "no response"}${res?.reason ? ` (${res.reason})` : ""}`);
    if (res?.result) return { result: res.result, reason: res.reason };
    // No response: the submit may have navigated to a confirmation page (which
    // tears down the content script). Verify before assuming anything.
    await delay(2500);
    if (await checkConfirmed(tabId)) return { result: "submitted" };
    return { result: "failed", reason: "no response from the application page" };
  } catch (e) {
    // sendMessage rejected. The usual cause is a SUCCESSFUL submit navigating to
    // a confirmation page, which closes the message channel. Check the page text
    // before calling it a failure — never lose a real submission.
    await delay(2500);
    if (await checkConfirmed(tabId)) {
      console.log(`[sasa] ${app.company}: confirmed after the channel closed (submit navigated)`);
      return { result: "submitted" };
    }
    console.error(`[sasa] ${app.company}: could not reach content script and no confirmation found:`, e);
    return { result: "failed", reason: "the application page blocked automation or closed before confirming" };
  }
}

// Read the (possibly navigated) tab for a real post-submit success signal. Used
// when the content script channel drops — a successful submit often navigates.
async function checkConfirmed(tabId: number): Promise<boolean> {
  try {
    const [out] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const SUCCESS = /thank you|thanks for applying|application (has been )?(received|submitted|sent)|successfully (submitted|applied|sent)|we('| ?ha)?ve received your|your application (is|has been)|submission (received|complete|successful)/i;
        const t = document.body?.innerText ?? "";
        if (SUCCESS.test(t)) return true;
        return !!document.querySelector('[class*="confirmation"],[data-testid*="success"],[data-testid*="confirmation"],[class*="postApply"]');
      },
    });
    return !!out?.result;
  } catch {
    return false;
  }
}

// Broadcast a progress event to the popup (ignored if no popup is open) and
// keep a live counter on the toolbar icon so progress is visible either way.
function emit(p: Record<string, unknown>) {
  try {
    void chrome.runtime.sendMessage({ type: "progress", ...p }).catch(() => {});
  } catch {
    /* no listener */
  }
}
function setBadge(text: string) {
  try {
    chrome.action.setBadgeBackgroundColor({ color: "#0a0a0a" });
    chrome.action.setBadgeText({ text });
  } catch {
    /* ignore */
  }
}

let running = false; // guard so the poll and a manual click never double-run

async function runQueue() {
  if (running) return { error: "Already submitting." };
  const cfg = await getConfig();
  if (!cfg.token) return { error: "Not paired. Paste your connect token first." };
  running = true;
  try {
    return await doRunQueue(cfg);
  } finally {
    running = false;
  }
}

async function doRunQueue(cfg: Awaited<ReturnType<typeof getConfig>>) {
  const { balance, applications } = await fetchQueue(cfg);
  const total = applications.length;
  console.log(`[sasa] queue: ${total} application(s), balance ${balance}`);
  emit({ phase: "begin", total });
  let submitted = 0;
  let needsUser = 0;
  let failed = 0;

  for (let i = 0; i < applications.length; i++) {
    const app = applications[i];
    setBadge(`${i + 1}/${total}`);
    emit({ phase: "start", index: i + 1, total, company: app.company, title: app.title });

    let resumeBase64: string | null = null;
    if (app.resumeUrl) {
      try {
        const r = await fetch(app.resumeUrl);
        if (r.ok) resumeBase64 = bufToBase64(await r.arrayBuffer());
        else console.warn(`[sasa] ${app.company}: resume fetch returned ${r.status}`);
      } catch (e) {
        console.warn(`[sasa] ${app.company}: resume download failed:`, e);
      }
    }
    const { result, reason } = await runOnTab(app, resumeBase64);
    await report(cfg, app.id, result, reason);
    console.log(`[sasa] ${app.company}: reported ${result}${reason ? ` (${reason})` : ""}`);
    if (result === "submitted") submitted++;
    else if (result === "needs_user") needsUser++;
    else failed++;
    emit({ phase: "item", index: i + 1, total, company: app.company, result, reason });

    if (i < applications.length - 1) await delay(jitter());
  }

  // Clear the badge shortly after finishing.
  setBadge(failed > 0 || needsUser > 0 ? "!" : "");
  setTimeout(() => setBadge(""), 8000);
  emit({ phase: "end", total, submitted, needsUser, failed, balance });

  return { balance, total, submitted, needsUser, failed };
}

// Poll the queue in the background so the toolbar badge reflects how many
// applications are waiting the moment they are approved (dashboard or Telegram).
// If auto-submit is on, kick the queue off too. Non-intrusive otherwise: just a count.
async function pollQueue() {
  if (running) return;
  const cfg = await getConfig();
  if (!cfg.token) return;
  try {
    const { applications } = await fetchQueue(cfg);
    const n = applications.length;
    setBadge(n > 0 ? String(n) : "");
    if (n > 0 && cfg.autoSubmit) {
      console.log(`[sasa] auto-submit: ${n} queued application(s)`);
      void runQueue().catch(() => {});
    }
  } catch {
    /* offline / not reachable — leave the badge as is */
  }
}

export default defineBackground(() => {
  // Check shortly after the browser starts, then on a recurring alarm.
  chrome.runtime.onStartup?.addListener(() => void pollQueue());
  chrome.runtime.onInstalled?.addListener(() => void pollQueue());
  chrome.alarms.create("sasa-poll", { periodInMinutes: 3 });
  chrome.alarms.onAlarm.addListener((a) => {
    if (a.name === "sasa-poll") void pollQueue();
  });

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type === "run") {
      runQueue()
        .then((r) => sendResponse(r))
        .catch((e) => sendResponse({ error: String(e) }));
      return true; // async
    }
    // Lightweight queue-count poll requested by the popup on open.
    if (msg?.type === "poll") {
      pollQueue().then(() => sendResponse({ ok: true })).catch(() => sendResponse({ ok: false }));
      return true; // async
    }
    // Universal autofill widget asks for the user's base profile + resume to prefill
    // the job form on the current page (content scripts can't reach the API directly).
    if (msg?.type === "prefillData") {
      (async () => {
        const cfg = await getConfig();
        if (!cfg.token) return sendResponse({ connected: false });
        const profile = await fetchProfile(cfg);
        if (!profile) return sendResponse({ connected: false });
        let resumeBase64: string | null = null;
        if (profile.resumeUrl) {
          try {
            const r = await fetch(profile.resumeUrl);
            if (r.ok) resumeBase64 = bufToBase64(await r.arrayBuffer());
          } catch {
            /* resume optional */
          }
        }
        sendResponse({ connected: true, fields: profile.fields, resumeBase64, resumeName: `${profile.fields.firstName || "cv"}.pdf` });
      })();
      return true; // async
    }
    // Fan a fill payload out to every frame in the tab (the form may be in an iframe).
    if (msg?.type === "broadcastFill") {
      const tabId = _sender.tab?.id;
      if (tabId != null) chrome.tabs.sendMessage(tabId, { type: "sasaFill", input: msg.input }).catch(() => {});
      sendResponse({ ok: true });
      return true;
    }
    // Universal widget: queue tailoring for the scraped job, return the app id.
    if (msg?.type === "tailorAdhoc") {
      (async () => {
        const cfg = await getConfig();
        if (!cfg.token) return sendResponse({ ok: false, error: "Connect Sasa in the popup first." });
        sendResponse(await tailorAdhoc(cfg, msg.payload as { title: string; company: string; jd: string; url: string; embellish?: boolean }));
      })();
      return true; // async
    }
    if (msg?.type === "markApplied") {
      (async () => {
        const cfg = await getConfig();
        if (!cfg.token) return sendResponse({ ok: false, error: "Connect Sasa in the popup first." });
        sendResponse(await markApplied(cfg, msg.payload as { title: string; company: string; url: string }));
      })();
      return true; // async
    }
    // Scan questions across all frames, then suggest answers from the profile.
    if (msg?.type === "suggestQuestions") {
      (async () => {
        try {
          const tabId = _sender.tab?.id;
          if (tabId == null) return sendResponse({ ok: false, error: "no tab" });
          const cfg = await getConfig();
          if (!cfg.token) return sendResponse({ ok: false, error: "Connect Sasa in the popup first." });

          let frames: { frameId: number }[] = [];
          try { frames = (await chrome.webNavigation.getAllFrames({ tabId })) ?? []; } catch { frames = [{ frameId: 0 }]; }
          if (frames.length === 0) frames = [{ frameId: 0 }];
          const scans = await Promise.all(
            frames.map((f) => chrome.tabs.sendMessage(tabId, { type: "sasaScan" }, { frameId: f.frameId }).catch(() => [])),
          );
          const byLabel = new Map<string, ScannedQuestion>();
          for (const arr of scans) {
            if (!Array.isArray(arr)) continue; // a frame may answer with a non-array; skip it
            for (const q of arr as ScannedQuestion[]) {
              if (q?.label && !byLabel.has(q.label.toLowerCase())) byLabel.set(q.label.toLowerCase(), q);
            }
          }
          const scanned = [...byLabel.values()];
          if (scanned.length === 0) return sendResponse({ ok: true, questions: [] });

          const ctx = (msg.context as { title?: string; company?: string; jd?: string }) ?? {};
          const { answers, error } = await suggestAnswers(cfg, {
            questions: scanned.map((q) => ({ id: q.label, label: q.label, type: q.type, options: q.options })),
            title: ctx.title,
            company: ctx.company,
            jd: ctx.jd,
          });
          if (error) return sendResponse({ ok: false, error });
          sendResponse({ ok: true, questions: scanned.map((q) => ({ ...q, answer: answers[q.label] || "" })) });
        } catch (e) {
          sendResponse({ ok: false, error: `Scan failed: ${e instanceof Error ? e.message : String(e)}` });
        }
      })();
      return true; // async
    }
    // Draft an application email/DM from the profile + scraped job.
    if (msg?.type === "draftMessage") {
      (async () => {
        const cfg = await getConfig();
        if (!cfg.token) return sendResponse({ ok: false, error: "Connect Sasa in the popup first." });
        const p = msg.payload as { title?: string; company?: string; jd?: string; contactKind: "email" | "dm"; contactValue: string };
        sendResponse(await draftMessage(cfg, p));
      })();
      return true; // async
    }
    // Score the open job against the user's profile (match percentage).
    if (msg?.type === "matchScore") {
      (async () => {
        const cfg = await getConfig();
        if (!cfg.token) return sendResponse({ ok: false, error: "Connect Sasa in the popup first." });
        sendResponse(await matchScore(cfg, msg.payload as { title?: string; company?: string; jd?: string; url?: string }));
      })();
      return true; // async
    }
    // Apply edited answers to the form (broadcast to every frame).
    if (msg?.type === "applyAnswers") {
      const tabId = _sender.tab?.id;
      if (tabId != null) chrome.tabs.sendMessage(tabId, { type: "sasaApply", answers: msg.answers }).catch(() => {});
      sendResponse({ ok: true });
      return true;
    }
    // Poll for the finished tailored CV + cover.
    if (msg?.type === "tailorResult") {
      (async () => {
        const cfg = await getConfig();
        if (!cfg.token) return sendResponse(null);
        sendResponse(await tailorResult(cfg, msg.id as string));
      })();
      return true; // async
    }
    // Has this job page already been tailored? (so we don't re-charge on revisit)
    if (msg?.type === "tailorLookup") {
      (async () => {
        const cfg = await getConfig();
        if (!cfg.token) return sendResponse({ found: false });
        sendResponse(await tailorLookup(cfg, msg.url as string));
      })();
      return true; // async
    }
    // Content script asks us to answer custom questions (it cannot reach the API directly).
    if (msg?.type === "answer") {
      (async () => {
        const cfg = await getConfig();
        const answers = await answerQuestions(cfg, msg.applicationId as string, msg.questions as AnswerQuestion[]);
        sendResponse({ answers });
      })();
      return true; // async
    }
    return undefined;
  });
});
