import { getConfig, setConfig, DEFAULT_BASE_URL } from "@/lib/config";
import { fetchStats } from "@/lib/api";

const STATE_LABEL: Record<string, string> = {
  drafted: "Tailoring",
  awaiting_review: "Review",
  needs_user: "Needs you",
  queued: "Queued",
  sending: "Sending",
  submitted: "Submitted",
  failed: "Failed",
  dismissed: "Skipped",
};
function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  return d <= 0 ? "today" : d === 1 ? "1d" : `${d}d`;
}

const el = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const inp = (id: string) => el<HTMLInputElement>(id);

function show(view: "setup" | "connected") {
  el("setup").classList.toggle("hidden", view !== "setup");
  el("connected").classList.toggle("hidden", view !== "connected");
  el("dot").className = `dot ${view === "connected" ? "on" : "off"}`;
}

function message(text: string, kind: "error" | "info" | "" = "") {
  const m = el("message");
  if (!text) {
    m.classList.add("hidden");
    return;
  }
  m.textContent = text;
  m.className = `message ${kind}`;
}

function result(text: string, kind: "ok" | "warn" | "") {
  const r = el("result");
  r.textContent = text;
  r.className = `result ${kind}`.trim();
  r.classList.remove("hidden");
}

// Load stats + recent activity into the connected view. Returns false if the
// token is rejected or the app is unreachable.
async function refreshCounts(): Promise<boolean> {
  const cfg = await getConfig();
  el("appUrl").textContent = cfg.baseUrl.replace(/^https?:\/\//, "");
  const stats = await fetchStats(cfg);
  if (!stats) {
    message("Could not reach the app, or the token is invalid. Check the App URL and token in Settings.", "error");
    return false;
  }
  // Remember which user this token is paired to, so the content script can reset the
  // extension if a different user signs in on usesasa.xyz in this browser.
  if (stats.userId) await chrome.storage.local.set({ pairedUser: stats.userId });
  el("s-ready").textContent = String(stats.counts.ready);
  el("s-submitted").textContent = String(stats.counts.submitted);
  el("s-credits").textContent = String(stats.balance);
  el("s-needs").textContent = String(stats.counts.needsYou);
  el("s-failed").textContent = String(stats.counts.failed);

  const list = el("activity");
  if (!stats.recent.length) {
    list.innerHTML = '<div class="empty">Nothing yet.</div>';
  } else {
    list.innerHTML = stats.recent
      .map((r) => {
        const label = STATE_LABEL[r.state] ?? r.state;
        const co = (r.company || "").replace(/</g, "&lt;");
        const ti = (r.title || "").replace(/</g, "&lt;");
        return `<div class="aitem"><span class="name"><b>${co}</b> · ${ti}</span><span class="tag ${r.state}">${label}</span><span class="muted tiny">${timeAgo(r.at)}</span></div>`;
      })
      .join("");
  }
  message("");
  return true;
}

async function render() {
  const cfg = await getConfig();
  inp("baseUrl").value = cfg.baseUrl;
  inp("autoSubmit").checked = cfg.autoSubmit;
  if (cfg.token) {
    inp("token").value = cfg.token;
    show("connected");
    void chrome.runtime.sendMessage({ type: "poll" }).catch(() => {});
    await refreshCounts();
  } else {
    show("setup");
  }
}

inp("autoSubmit").addEventListener("change", async () => {
  await setConfig({ autoSubmit: inp("autoSubmit").checked });
});

el<HTMLButtonElement>("connect").addEventListener("click", async () => {
  const baseUrl = inp("baseUrl").value.trim().replace(/\/$/, "");
  const token = inp("token").value.trim();
  if (!token) {
    message("Paste your connect token first.", "error");
    return;
  }
  const btn = el<HTMLButtonElement>("connect");
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span>Connecting';
  await setConfig({ baseUrl: baseUrl || DEFAULT_BASE_URL, token });
  show("connected");
  const ok = await refreshCounts();
  btn.disabled = false;
  btn.textContent = "Connect";
  if (!ok) show("setup"); // token rejected, send them back to fix it
});

// Live progress streamed from the background while the queue runs.
type Progress =
  | { type: "progress"; phase: "begin"; total: number }
  | { type: "progress"; phase: "start"; index: number; total: number; company: string; title: string }
  | { type: "progress"; phase: "item"; index: number; total: number; company: string; result: string }
  | { type: "progress"; phase: "end"; total: number; submitted: number; needsUser: number; failed: number; balance: number };

const rowId = (i: number) => `prow-${i}`;

chrome.runtime.onMessage.addListener((msg: Progress) => {
  if (msg?.type !== "progress") return;
  const box = el("progress");
  const head = el("progressHead");
  const list = el("progressList");

  if (msg.phase === "begin") {
    box.classList.remove("hidden");
    list.innerHTML = "";
    head.textContent = msg.total === 0 ? "Nothing queued" : `Submitting 0 of ${msg.total}`;
  } else if (msg.phase === "start") {
    head.textContent = `Submitting ${msg.index} of ${msg.total}`;
    let row = document.getElementById(rowId(msg.index));
    if (!row) {
      row = document.createElement("div");
      row.id = rowId(msg.index);
      row.className = "pitem";
      list.appendChild(row);
    }
    row.innerHTML = `<span class="name">${msg.company}</span><span class="tag doing">working</span>`;
  } else if (msg.phase === "item") {
    const row = document.getElementById(rowId(msg.index));
    if (row) row.innerHTML = `<span class="name">${msg.company}</span><span class="tag ${msg.result}">${msg.result.replace("_", " ")}</span>`;
  } else if (msg.phase === "end") {
    head.textContent = `Done. ${msg.submitted} submitted, ${msg.needsUser} need you, ${msg.failed} failed.`;
  }
});

el<HTMLButtonElement>("run").addEventListener("click", async () => {
  const btn = el<HTMLButtonElement>("run");
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span>Working';
  el("result").classList.add("hidden");
  message("Each application opens in a tab and submits in your session.", "info");

  const res = (await chrome.runtime.sendMessage({ type: "run" })) as
    | { error?: string; total?: number; submitted?: number; needsUser?: number; failed?: number; balance?: number }
    | undefined;

  btn.disabled = false;
  btn.textContent = "Submit queued applications";
  message("");

  if (!res) {
    message("No response from the agent. Try again.", "error");
  } else if (res.error) {
    message(res.error, "error");
  } else if ((res.total ?? 0) === 0) {
    result("Nothing to submit. Approve a match to queue it.", "");
  } else {
    const kind = (res.failed ?? 0) > 0 || (res.needsUser ?? 0) > 0 ? "warn" : "ok";
    result(
      `Submitted ${res.submitted}/${res.total}. Needs you ${res.needsUser}. Failed ${res.failed}. Credits left ${res.balance}.`,
      kind,
    );
  }
  await refreshCounts();
});

el<HTMLButtonElement>("refresh").addEventListener("click", async () => {
  const btn = el<HTMLButtonElement>("refresh");
  btn.textContent = "Refreshing…";
  await refreshCounts();
  btn.textContent = "Refresh";
});

el<HTMLButtonElement>("edit").addEventListener("click", () => {
  message("");
  show("setup");
});

el<HTMLButtonElement>("disconnect").addEventListener("click", async () => {
  await setConfig({ token: "" });
  inp("token").value = "";
  message("");
  el("result").classList.add("hidden");
  show("setup");
});

render();
