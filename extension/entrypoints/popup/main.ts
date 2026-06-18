import { getConfig, setConfig } from "@/lib/config";
import { fetchQueue } from "@/lib/api";

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

// Friendly mapping for the queue fetch errors thrown by fetchQueue ("queue 401" etc).
function explain(e: unknown): string {
  const s = String(e);
  if (s.includes("401")) return "That token is invalid or expired. Generate a new one in Settings.";
  if (s.includes("Failed to fetch") || s.includes("NetworkError")) return "Could not reach the app. Check the App URL and that it is running.";
  return "Something went wrong. Please try again.";
}

// Load queue counts into the connected view; returns false if the token is rejected.
async function refreshCounts(): Promise<boolean> {
  const cfg = await getConfig();
  el("appUrl").textContent = cfg.baseUrl.replace(/^https?:\/\//, "");
  try {
    const { balance, applications } = await fetchQueue(cfg);
    el("pending").textContent = String(applications.length);
    el("credits").textContent = String(balance);
    message("");
    return true;
  } catch (e) {
    message(explain(e), "error");
    return false;
  }
}

async function render() {
  const cfg = await getConfig();
  inp("baseUrl").value = cfg.baseUrl;
  if (cfg.token) {
    inp("token").value = cfg.token;
    show("connected");
    await refreshCounts();
  } else {
    show("setup");
  }
}

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
  await setConfig({ baseUrl: baseUrl || "http://localhost:3000", token });
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
  message("Applications open in background tabs and submit in your session.", "info");

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
