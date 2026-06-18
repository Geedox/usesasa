import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, applications, jobs, companies, matches } from "@/lib/db/schema";
import { SITE_URL } from "@/lib/site";
import { enqueueTailorApplication } from "@/lib/queue";

const TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const API = (method: string) => `https://api.telegram.org/bot${TOKEN}/${method}`;

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
    });
    const data = (await res.json()) as { ok: boolean; result?: T; description?: string };
    if (!data.ok) {
      console.error(`[telegram] ${method} failed:`, data.description);
      return null;
    }
    return data.result ?? null;
  } catch (err) {
    // Keep it to one concise line (no stack dump) — the polling loop handles backoff.
    const cause = (err as { cause?: { code?: string } })?.cause?.code;
    console.warn(`[telegram] ${method} unreachable${cause ? ` (${cause})` : ""}`);
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
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
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
    "Connected. I will message you here when an application is tailored and ready to review.",
  );
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
    await db.update(applications).set({ state: "drafted" }).where(eq(applications.id, appId));
    await enqueueTailorApplication({ applicationId: appId });
    await answerCallback(cb.id, "Rewriting.");
    await editText(String(chatId), messageId, "Rewriting it without those claims. I will message you when it is ready.");
  } else if (action === "requeue") {
    await db.update(applications).set({ state: "queued", submissionNote: null }).where(eq(applications.id, appId));
    await answerCallback(cb.id, "Queued again.");
    await editText(String(chatId), messageId, "Queued again. Run Submit in the extension to retry it.");
  } else if (action === "approve") {
    await db.update(applications).set({ state: "queued" }).where(eq(applications.id, appId));
    await answerCallback(cb.id, "Queued for submission.");
    await editText(String(chatId), messageId, "Queued. Open the Sasa extension to submit it from your browser.");
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
    const m = u.message.text.match(/^\/start\s+(\S+)/);
    if (m) await handleStart(u.message.chat.id, m[1]);
  } else if (u.callback_query) {
    await handleCallback(u.callback_query);
  }
}

// Long-poll getUpdates forever. Runs in the worker; no public webhook needed.
export async function startTelegramPolling(): Promise<void> {
  if (!telegramEnabled()) {
    console.log("[telegram] TELEGRAM_BOT_TOKEN not set — review nudges disabled");
    return;
  }
  const username = await getBotUsername();
  console.log(`[telegram] polling as @${username ?? "?"}`);

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
