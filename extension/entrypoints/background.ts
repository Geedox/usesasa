import { defineBackground } from "wxt/utils/define-background";
import { getConfig } from "@/lib/config";
import { fetchQueue, report, answerQuestions, type QueuedApp, type SubmitResult, type AnswerQuestion } from "@/lib/api";

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
  // Open in the background so the popup stays open (and the user is not yanked
  // between tabs). Content scripts still run on inactive tabs.
  const tab = await chrome.tabs.create({ url: app.applyUrl, active: false });
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
    return { result: res?.result ?? "failed", reason: res?.reason };
  } catch (e) {
    console.error(`[sasa] ${app.company}: could not reach content script (page may block injection):`, e);
    return { result: "failed", reason: "the application page blocked automation" };
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

async function runQueue() {
  const cfg = await getConfig();
  if (!cfg.token) return { error: "Not paired. Paste your connect token first." };

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

export default defineBackground(() => {
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type === "run") {
      runQueue()
        .then((r) => sendResponse(r))
        .catch((e) => sendResponse({ error: String(e) }));
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
