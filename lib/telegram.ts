import { and, eq } from "drizzle-orm";
import { ProxyAgent } from "undici";
import { db } from "@/lib/db";
import { users, applications, jobs, companies, matches } from "@/lib/db/schema";
import { SITE_URL } from "@/lib/site";
import { enqueueTailorApplication, enqueueSubmitApplication } from "@/lib/queue";
import { generateResumePdf } from "@/lib/resume-pdf";
import { canUseSasa } from "@/lib/can-use";
import { searchRolesForUser } from "@/lib/matching/query";

const TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const API = (method: string) => `https://api.telegram.org/bot${TOKEN}/${method}`;

// If a proxy is configured, route Telegram calls through it (Node's fetch does
// not honor system proxies on its own). Useful where Telegram is blocked.
const PROXY_URL = process.env.HTTPS_PROXY || process.env.https_proxy || process.env.ALL_PROXY || "";
const proxyDispatcher = PROXY_URL ? new ProxyAgent(PROXY_URL) : undefined;
if (PROXY_URL) console.log(`[telegram] routing through proxy ${PROXY_URL.replace(/\/\/.*@/, "//***@")}`);

export function telegramEnabled(): boolean {
  return TOKEN.length > 0;
}

// Thin wrapper over the Telegram Bot API. Returns the parsed `result`, or null on error.
async function call<T = unknown>(method: string, body?: Record<string, unknown>): Promise<T | null> {
  if (!TOKEN) return null;
  try {
    const res = await fetch(API(method), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
      ...(proxyDispatcher ? { dispatcher: proxyDispatcher } : {}),
    } as RequestInit & { dispatcher?: unknown });
    const data = (await res.json()) as { ok: boolean; result?: T; description?: string };
    if (!data.ok) {
      console.error(`[telegram] ${method} failed:`, data.description);
      return null;
    }
    return data.result ?? null;
  } catch {
    // Silent: callers decide whether/how to log (the polling loop reports once and
    // backs off, so we don't flood the terminal when Telegram is network-blocked).
    return null;
  }
}

export async function sendMessage(
  chatId: string,
  text: string,
  replyMarkup?: Record<string, unknown>,
): Promise<void> {
  await call("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
  });
}

// Send a file (e.g. the tailored resume PDF) so the user can preview/download it
// in Telegram without opening the dashboard.
export async function sendDocument(chatId: string, buffer: Buffer, filename: string, caption?: string): Promise<void> {
  if (!TOKEN) return;
  try {
    const form = new FormData();
    form.append("chat_id", chatId);
    if (caption) form.append("caption", caption);
    form.append("document", new Blob([new Uint8Array(buffer)], { type: "application/pdf" }), filename);
    await fetch(API("sendDocument"), {
      method: "POST",
      body: form,
      ...(proxyDispatcher ? { dispatcher: proxyDispatcher } : {}),
    } as RequestInit & { dispatcher?: unknown });
  } catch {
    console.warn("[telegram] sendDocument unreachable");
  }
}

async function answerCallback(callbackId: string, text?: string): Promise<void> {
  await call("answerCallbackQuery", { callback_query_id: callbackId, ...(text ? { text } : {}) });
}

async function editText(chatId: string, messageId: number, text: string): Promise<void> {
  await call("editMessageText", { chat_id: chatId, message_id: messageId, text, parse_mode: "HTML" });
}

let cachedUsername: string | null = null;
export async function getBotUsername(): Promise<string | null> {
  if (cachedUsername) return cachedUsername;
  const me = await call<{ username?: string }>("getMe");
  cachedUsername = me?.username ?? null;
  return cachedUsername;
}

// ---- review nudge ----

// Send a "ready to review" nudge for one application (no-op if Telegram is off or
// the user hasn't linked their account).
export async function notifyReviewReady(applicationId: string): Promise<void> {
  if (!telegramEnabled()) return;

  const app = await db.query.applications.findFirst({ where: eq(applications.id, applicationId) });
  if (!app) return;

  const user = await db.query.users.findFirst({ where: eq(users.id, app.userId) });
  if (!user?.telegramChatId) return;

  const job = await db.query.jobs.findFirst({ where: eq(jobs.id, app.jobId) });
  const company = job ? await db.query.companies.findFirst({ where: eq(companies.id, job.companyId) }) : null;
  const match = await db.query.matches.findFirst({
    where: and(eq(matches.userId, app.userId), eq(matches.jobId, app.jobId)),
  });

  const title = job?.title ?? "a role";
  const companyName = company?.name ?? "a company";
  const scoreLine = match ? `Match ${match.score}%\n` : "";
  const embellished = (app.tailoringValidation as { embellished?: boolean } | null)?.embellished === true;
  const embellishLine = embellished
    ? "\n\n⚠️ Embellished: this draft may include skills not in your profile. Make sure you can speak to them."
    : "";
  const text =
    `<b>${escapeHtml(companyName)}: ${escapeHtml(title)}</b>\n` +
    `${scoreLine}Your CV and cover letter are ready. Approve to queue it for submission.${embellishLine}`;

  await sendMessage(user.telegramChatId, text, {
    inline_keyboard: [
      [
        { text: "Approve and queue", callback_data: `approve:${app.id}` },
        { text: "Skip", callback_data: `skip:${app.id}` },
      ],
      [{ text: "Review on web", url: `${SITE_URL}/dashboard/applications/${app.id}` }],
    ],
  });

  // Attach the tailored resume so the user can preview it in Telegram.
  try {
    const pdf = await generateResumePdf(app.id);
    if (pdf) await sendDocument(user.telegramChatId, pdf.buffer, pdf.filename, "Tailored resume for this role");
  } catch (err) {
    console.warn("[telegram] could not attach resume PDF:", err);
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Sent when an application is actually submitted from the user's browser.
export async function notifySubmitted(applicationId: string, balance: number): Promise<void> {
  if (!telegramEnabled()) return;
  const app = await db.query.applications.findFirst({ where: eq(applications.id, applicationId) });
  if (!app) return;
  const user = await db.query.users.findFirst({ where: eq(users.id, app.userId) });
  if (!user?.telegramChatId) return;
  const job = await db.query.jobs.findFirst({ where: eq(jobs.id, app.jobId) });
  const company = job ? await db.query.companies.findFirst({ where: eq(companies.id, job.companyId) }) : null;
  await sendMessage(
    user.telegramChatId,
    `✅ Applied to <b>${escapeHtml(company?.name ?? "a company")}: ${escapeHtml(job?.title ?? "a role")}</b>.\n` +
      `${balance} application credit${balance === 1 ? "" : "s"} left.`,
  );
}

// Sent when the extension could not finish a submission (an unmapped required
// field, or the page blocked it). Tells the user exactly what blocked it and
// offers to open the form to finish manually, try again, or skip.
export async function notifySubmissionBlocked(
  applicationId: string,
  result: "needs_user" | "failed",
  note: string,
): Promise<void> {
  if (!telegramEnabled()) return;

  const app = await db.query.applications.findFirst({ where: eq(applications.id, applicationId) });
  if (!app) return;
  const user = await db.query.users.findFirst({ where: eq(users.id, app.userId) });
  if (!user?.telegramChatId) return;

  const job = await db.query.jobs.findFirst({ where: eq(jobs.id, app.jobId) });
  const company = job ? await db.query.companies.findFirst({ where: eq(companies.id, job.companyId) }) : null;

  // Paused waiting for an emailed verification code: ask the user to just reply
  // with the code; the next text message they send is treated as the code.
  if (app.awaitingCode) {
    const text =
      `<b>${escapeHtml(company?.name ?? "a company")}: ${escapeHtml(job?.title ?? "a role")}</b>\n` +
      `${escapeHtml(note)}\n\n` +
      `Reply to this chat with the code and I will enter it and finish the application.`;
    await sendMessage(user.telegramChatId, text);
    return;
  }

  const lead =
    result === "needs_user"
      ? "I filled most of this, but it needs something I cannot answer for you:"
      : "I could not finish this one automatically:";
  const text =
    `<b>${escapeHtml(company?.name ?? "a company")}: ${escapeHtml(job?.title ?? "a role")}</b>\n` +
    `${lead}\n\n${escapeHtml(note)}\n\n` +
    `Open it to finish and submit yourself, or skip it. Nothing was sent and no credit was used.`;

  const buttons: { text: string; url?: string; callback_data?: string }[][] = [];
  if (job?.url) buttons.push([{ text: "Open the application", url: job.url }]);
  buttons.push([
    { text: "Try again", callback_data: `requeue:${app.id}` },
    { text: "Skip", callback_data: `skip:${app.id}` },
  ]);

  await sendMessage(user.telegramChatId, text, { inline_keyboard: buttons });
}

// Sent when the no-fabrication check flagged claims it could not verify. Offers a
// safe workaround (rewrite without those claims, keeping the CV structure) and a
// link to edit on the web. No auto-submit path here.
export async function notifyNeedsReview(applicationId: string): Promise<void> {
  if (!telegramEnabled()) return;

  const app = await db.query.applications.findFirst({ where: eq(applications.id, applicationId) });
  if (!app) return;
  const user = await db.query.users.findFirst({ where: eq(users.id, app.userId) });
  if (!user?.telegramChatId) return;

  const job = await db.query.jobs.findFirst({ where: eq(jobs.id, app.jobId) });
  const company = job ? await db.query.companies.findFirst({ where: eq(companies.id, job.companyId) }) : null;

  const fabrications = ((app.tailoringValidation as { fabrications?: string[] } | null)?.fabrications ?? []).slice(0, 5);
  const list = fabrications.map((f) => `• ${escapeHtml(f)}`).join("\n");

  const text =
    `<b>${escapeHtml(company?.name ?? "a company")}: ${escapeHtml(job?.title ?? "a role")}</b>\n` +
    `I drafted this, but a check flagged claims your profile may not support:\n\n${list}\n\n` +
    `I can rewrite it without these claims (your CV structure stays the same), or you can edit it on the web.`;

  await sendMessage(user.telegramChatId, text, {
    inline_keyboard: [
      [{ text: "Rewrite without these", callback_data: `redo:${app.id}` }],
      [{ text: "Review on web", url: `${SITE_URL}/dashboard/applications/${app.id}` }],
    ],
  });
}

// Gate 1: ask whether to apply to a freshly scored match (before any tailoring).
export async function notifyNewMatch(opts: {
  chatId: string;
  jobId: string;
  company: string;
  title: string;
  score: number;
  reason?: string;
}): Promise<void> {
  if (!telegramEnabled()) return;
  const reasonLine = opts.reason ? `\n${escapeHtml(opts.reason)}` : "";
  const text =
    `<b>${escapeHtml(opts.company)}: ${escapeHtml(opts.title)}</b>\n` +
    `Match ${opts.score}%${reasonLine}\n\nShould I tailor your CV and apply?`;
  await sendMessage(opts.chatId, text, {
    inline_keyboard: [
      [
        { text: "Yes, apply", callback_data: `apply:${opts.jobId}` },
        { text: "Skip", callback_data: `pass:${opts.jobId}` },
      ],
    ],
  });
}

// ---- update handling (long polling) ----

type TgUpdate = {
  update_id: number;
  message?: { chat: { id: number }; text?: string };
  callback_query?: {
    id: string;
    data?: string;
    message?: { chat: { id: number }; message_id: number };
  };
};

async function handleStart(chatId: number, token: string): Promise<void> {
  const user = await db.query.users.findFirst({ where: eq(users.telegramLinkToken, token) });
  if (!user) {
    await sendMessage(String(chatId), "That link is invalid or expired. Open Settings in Sasa and connect again.");
    return;
  }
  await db
    .update(users)
    .set({ telegramChatId: String(chatId), telegramLinkToken: null })
    .where(eq(users.id, user.id));
  await sendMessage(
    String(chatId),
    "Connected. Ask me for roles any time, for example:\n" +
      "• remote backend roles\n" +
      "• visa sponsorship jobs in Europe\n" +
      "• product internships in Lagos\n\n" +
      "I will reply with your best matches and their percentages. I will also message you when an application you approved is ready to review.",
  );
}

// Short help / usage text.
async function sendHelp(chatId: number | string): Promise<void> {
  await sendMessage(
    String(chatId),
    "Tell me what you are looking for and I will find your best matches, for example:\n" +
      "• remote backend roles\n" +
      "• visa sponsorship jobs in Europe\n" +
      "• data internships in Lagos\n" +
      "• senior product roles\n\n" +
      "For each match I show the fit percentage and a button to tailor your CV and apply.",
  );
}

// On-demand role search: the user asks in plain language, the agent finds their top
// matches and replies with each one (fit % + an Apply button). This replaces the old
// behaviour where the bot pushed roles on its own.
async function handleRoleQuery(chatId: number | string, text: string): Promise<void> {
  const user = await db.query.users.findFirst({ where: eq(users.telegramChatId, String(chatId)) });
  if (!user) {
    await sendMessage(String(chatId), "Connect your Telegram from Sasa settings first, then ask me for roles.");
    return;
  }

  await sendMessage(String(chatId), "On it. Finding your best matches…");
  let results;
  try {
    results = await searchRolesForUser(user.id, text);
  } catch (e) {
    console.error("[telegram] role query failed:", e);
    await sendMessage(String(chatId), "Something went wrong finding roles. Please try again in a moment.");
    return;
  }

  if (!results.length) {
    await sendMessage(
      String(chatId),
      "I could not find matching roles for that yet. Try another area or role, or give the next scan a little time to gather fresh jobs. You can also browse everything on your dashboard.",
    );
    return;
  }

  await sendMessage(String(chatId), `Here are your top ${results.length} matches for that:`);
  for (const r of results) {
    await notifyNewMatch({
      chatId: String(chatId),
      jobId: r.jobId,
      company: r.company,
      title: r.title,
      score: r.score,
      reason: r.reason,
    });
  }
}

async function handleCallback(cb: NonNullable<TgUpdate["callback_query"]>): Promise<void> {
  const chatId = cb.message?.chat.id;
  const messageId = cb.message?.message_id;
  const [action, targetId] = (cb.data ?? "").split(":");
  if (!chatId || !messageId || !targetId) return await answerCallback(cb.id);

  // The chat must belong to a linked user.
  const user = await db.query.users.findFirst({ where: eq(users.telegramChatId, String(chatId)) });
  if (!user) {
    await answerCallback(cb.id, "Not linked.");
    return;
  }

  // Block credit-spending actions when the user has no credits / allowance left.
  const blockedNoCredit = async (): Promise<boolean> => {
    const can = await canUseSasa(user.id);
    if (can.ok) return false;
    await answerCallback(cb.id, can.error);
    await editText(String(chatId), messageId, `${can.error} Open Sasa to top up, then try again.`);
    return true;
  };

  // Gate 1 actions operate on a match (targetId = jobId).
  if (action === "apply" || action === "pass") {
    const match = await db.query.matches.findFirst({
      where: and(eq(matches.userId, user.id), eq(matches.jobId, targetId)),
    });
    if (!match) {
      await answerCallback(cb.id, "Not found.");
      return;
    }
    if (action === "pass") {
      await db.update(matches).set({ userAction: "skipped" }).where(eq(matches.id, match.id));
      await answerCallback(cb.id, "Skipped.");
      await editText(String(chatId), messageId, "Skipped. I will not apply to this one.");
      return;
    }
    if (await blockedNoCredit()) return;
    // apply → create the application (dedup-safe) and tailor it; gate 2 follows when ready.
    await db.update(matches).set({ userAction: "queued" }).where(eq(matches.id, match.id));
    const [created] = await db
      .insert(applications)
      .values({ userId: user.id, jobId: targetId, matchId: match.id, state: "drafted" })
      .onConflictDoNothing({ target: [applications.userId, applications.jobId] })
      .returning({ id: applications.id });
    if (created) await enqueueTailorApplication({ applicationId: created.id });
    await answerCallback(cb.id, "On it.");
    await editText(String(chatId), messageId, "On it. Tailoring your CV and cover letter now.");
    return;
  }

  // Gate 2 actions operate on an application (targetId = applicationId).
  const appId = targetId;
  const app = await db.query.applications.findFirst({
    where: and(eq(applications.id, appId), eq(applications.userId, user.id)),
  });
  if (!app) {
    await answerCallback(cb.id, "Not found.");
    return;
  }

  if (action === "redo") {
    if (await blockedNoCredit()) return;
    await db.update(applications).set({ state: "drafted" }).where(eq(applications.id, appId));
    await enqueueTailorApplication({ applicationId: appId });
    await answerCallback(cb.id, "Rewriting.");
    await editText(String(chatId), messageId, "Rewriting it without those claims. I will message you when it is ready.");
  } else if (action === "requeue") {
    if (await blockedNoCredit()) return;
    await db.update(applications).set({ state: "queued", submissionNote: null }).where(eq(applications.id, appId));
    await enqueueSubmitApplication({ applicationId: appId });
    await answerCallback(cb.id, "Submitting again.");
    await editText(String(chatId), messageId, "On it. I am submitting this one again in the cloud and will confirm here when it is done.");
  } else if (action === "approve") {
    if (await blockedNoCredit()) return;
    await db.update(applications).set({ state: "queued" }).where(eq(applications.id, appId));
    await enqueueSubmitApplication({ applicationId: appId });
    await answerCallback(cb.id, "Submitting now.");
    await editText(String(chatId), messageId, "Approved. I am submitting it in the cloud now and will confirm here when it is done.");
  } else if (action === "skip") {
    await db.update(applications).set({ state: "dismissed" }).where(eq(applications.id, appId));
    await answerCallback(cb.id, "Skipped.");
    await editText(String(chatId), messageId, "Skipped. I will not submit this one.");
  } else {
    await answerCallback(cb.id);
  }
}

async function processUpdate(u: TgUpdate): Promise<void> {
  if (u.message?.text) {
    const text = u.message.text.trim();
    const chatId = u.message.chat.id;

    const startMatch = text.match(/^\/start\s+(\S+)/);
    if (startMatch) { await handleStart(chatId, startMatch[1]); return; }
    if (text === "/start" || text === "/help") { await sendHelp(chatId); return; }
    if (text.startsWith("/")) { await sendHelp(chatId); return; } // unknown command

    // If an application is paused waiting for an emailed code, a code-like reply is
    // the code. Otherwise, treat the message as a natural-language role search.
    if (await handleCodeReply(chatId, text)) return;
    await handleRoleQuery(chatId, text);
  } else if (u.callback_query) {
    await handleCallback(u.callback_query);
  }
}

// A plain text reply is treated as the verification code for the user's most
// recent application paused awaiting a code.
// Try to treat a message as the verification code for an application paused awaiting
// one. Returns true if it was consumed as a code (so the caller stops), false to let
// the message fall through to the role search.
async function handleCodeReply(chatId: number | string, text: string): Promise<boolean> {
  if (!/^[A-Za-z0-9\-]{3,12}$/.test(text)) return false; // has spaces/too long — not a code
  const user = await db.query.users.findFirst({ where: eq(users.telegramChatId, String(chatId)) });
  if (!user) return false;
  const app = await db.query.applications.findFirst({
    where: and(eq(applications.userId, user.id), eq(applications.awaitingCode, true)),
    orderBy: (a, { desc }) => [desc(a.createdAt)],
  });
  if (!app) return false; // nothing waiting on a code — treat as a role query instead
  await sendMessage(String(chatId), "Got it. Entering the code and finishing the application now…");
  const { resumeWithCode } = await import("@/lib/submit/steel");
  const r = await resumeWithCode(app.id, text);
  if (r.result === "submitted") await sendMessage(String(chatId), "Done. Your application was submitted.");
  else await sendMessage(String(chatId), `That did not complete it: ${escapeHtml(r.reason ?? "unknown")}. You can open the dashboard to finish it.`);
  return true;
}

// Long-poll getUpdates forever. Runs in the worker; no public webhook needed.
export async function startTelegramPolling(): Promise<void> {
  // Telegram allows only ONE getUpdates poller per bot token. If more than one
  // worker runs on the same token (e.g. staging + production), they fight and log
  // endless "Conflict: terminated by other getUpdates request". So polling is
  // opt-in: set RUN_TELEGRAM_BOT=1 on exactly one worker (production). Leave it
  // unset everywhere else.
  if (process.env.RUN_TELEGRAM_BOT !== "1") {
    console.log("[telegram] polling disabled — set RUN_TELEGRAM_BOT=1 on exactly one worker to enable review nudges");
    return;
  }
  if (!telegramEnabled()) {
    console.log("[telegram] TELEGRAM_BOT_TOKEN not set — review nudges disabled");
    return;
  }
  const username = await getBotUsername();
  if (username) {
    console.log(`[telegram] polling as @${username}`);
  } else {
    console.warn(
      "[telegram] cannot reach api.telegram.org from this network (often an ISP block of Telegram). " +
        "Nudges are paused; the agent still works on the dashboard. Set HTTPS_PROXY or use a VPN to enable Telegram. " +
        "On the deployed worker this works without a proxy.",
    );
  }

  let offset = 0;
  let failures = 0;
  const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const updates = await call<TgUpdate[]>("getUpdates", {
      offset,
      timeout: 30,
      allowed_updates: ["message", "callback_query"],
    });

    if (updates === null) {
      // Network/API failure. Back off (capped at 60s) instead of hammering, and
      // tell the user once that Telegram is unreachable so the log is not a wall
      // of errors. The rest of the worker keeps running normally.
      failures++;
      if (failures === 3) {
        console.warn(
          "[telegram] cannot reach api.telegram.org from this network. Review nudges are paused; the agent still works on the dashboard. Retrying quietly.",
        );
      }
      const backoff = Math.min(60_000, 3_000 * 2 ** Math.min(failures, 5));
      await delay(backoff);
      continue;
    }

    if (failures > 0) {
      console.log("[telegram] reconnected");
      failures = 0;
    }
    for (const u of updates) {
      offset = u.update_id + 1;
      try {
        await processUpdate(u);
      } catch (err) {
        console.error("[telegram] update failed:", err);
      }
    }
  }
}
