import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { accounts, preferences } from "@/lib/db/schema";

// Read-only Gmail integration. We reuse the user's Better Auth Google account — once
// they grant gmail.readonly via authClient.linkSocial(), Better Auth stores the
// upgraded token/scope on the `accounts` row. We read those tokens (refreshing when
// needed) to scan job-related emails for OTPs and verification links. We never store
// message bodies — we read, extract, and discard.

export const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const GMAIL_API = "https://gmail.googleapis.com/gmail/v1/users/me";

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";

export function gmailConfigured(): boolean {
  return !!CLIENT_ID && !!CLIENT_SECRET;
}

async function googleAccount(userId: string) {
  return db.query.accounts.findFirst({
    where: and(eq(accounts.userId, userId), eq(accounts.providerId, "google")),
  });
}

// True once the user has granted the gmail.readonly scope on their Google account.
export async function hasGmailScope(userId: string): Promise<boolean> {
  const acc = await googleAccount(userId);
  return !!acc?.scope && acc.scope.includes("gmail.readonly");
}

// Whether Sasa should actually read this user's Gmail: scope granted AND not paused
// via the Email Integrations toggle (onboarding.emailNotifications.gmailEnabled).
export async function isGmailActive(userId: string): Promise<boolean> {
  if (!(await hasGmailScope(userId))) return false;
  const prefs = await db.query.preferences.findFirst({ where: eq(preferences.userId, userId) });
  const flag = (prefs?.onboarding as { emailNotifications?: { gmailEnabled?: boolean } } | null)?.emailNotifications
    ?.gmailEnabled;
  return flag !== false;
}

type TokenResponse = { access_token?: string; expires_in?: number; error?: string };

async function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: "refresh_token",
    }),
  });
  return (await res.json()) as TokenResponse;
}

// A valid Gmail access token for the user, refreshing the Better Auth account token
// if it has expired. Returns null if the user has not granted the Gmail scope.
async function getValidAccessToken(userId: string): Promise<string | null> {
  const acc = await googleAccount(userId);
  if (!acc?.scope?.includes("gmail.readonly")) return null;

  const fresh = acc.accessToken && acc.accessTokenExpiresAt && acc.accessTokenExpiresAt.getTime() > Date.now() + 60_000;
  if (fresh) return acc.accessToken;

  if (!acc.refreshToken) return acc.accessToken ?? null;
  const t = await refreshAccessToken(acc.refreshToken);
  if (!t.access_token) return acc.accessToken ?? null;

  await db
    .update(accounts)
    .set({ accessToken: t.access_token, accessTokenExpiresAt: new Date(Date.now() + (t.expires_in ?? 3600) * 1000), updatedAt: new Date() })
    .where(eq(accounts.id, acc.id));
  return t.access_token;
}

// ---- OTP / verification-link extraction ----

function decodeB64Url(data: string): string {
  try {
    return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8");
  } catch {
    return "";
  }
}

type GmailPart = { mimeType?: string; body?: { data?: string }; parts?: GmailPart[] };

function collectText(part: GmailPart | undefined): string {
  if (!part) return "";
  let out = "";
  if (part.body?.data && (part.mimeType === "text/plain" || part.mimeType === "text/html")) {
    out += decodeB64Url(part.body.data) + "\n";
  }
  for (const p of part.parts ?? []) out += collectText(p);
  return out;
}

const CODE_RX = /\b(\d{4,8})\b/g;
const CODE_CONTEXT_RX = /(code|otp|verification|verify|confirm|one[- ]?time|passcode)/i;
const LINK_RX = /https?:\/\/[^\s"'<>)]+/gi;
const VERIFY_LINK_RX = /(verify|confirm|activate|magic|authenticate|validation|verification)/i;

export type OtpResult = { code: string | null; links: string[] };

// Pull the most likely verification code and any verification links from text.
export function extractOtp(text: string): OtpResult {
  const stripped = text.replace(/<[^>]+>/g, " ");
  let code: string | null = null;
  const lines = stripped.split(/\n|\.\s/);
  for (const line of lines) {
    if (CODE_CONTEXT_RX.test(line)) {
      const m = line.match(/\b(\d{4,8})\b/);
      if (m) {
        code = m[1];
        break;
      }
    }
  }
  if (!code) {
    const all = [...stripped.matchAll(CODE_RX)].map((m) => m[1]).filter((c) => c.length >= 4 && c.length <= 8);
    if (all.length === 1) code = all[0];
  }
  const links = [...stripped.matchAll(LINK_RX)].map((m) => m[0]).filter((u) => VERIFY_LINK_RX.test(u));
  return { code, links: [...new Set(links)].slice(0, 5) };
}

// ---- inbox: classify + list job-related emails (read live, never stored) ----

export type InboxCategory = "verification" | "rejection" | "interview" | "assessment" | "reminder" | "offer" | "other";

export function classifyEmail(text: string): InboxCategory {
  const t = text.toLowerCase();
  if (/\boffer\b|pleased to offer|extend(ing)? an offer|job offer|offer letter/.test(t)) return "offer";
  if (/unfortunately|not moving forward|regret to inform|other candidates|not be moving|not selected|decided to proceed with/.test(t)) return "rejection";
  if (/interview|phone screen|schedule a (call|time|chat)|your availability|meet with the team|book a time/.test(t)) return "interview";
  if (/assessment|coding (challenge|test|exercise)|take[- ]?home|hackerrank|codility|online test|skills test/.test(t)) return "assessment";
  if (/\botp\b|one[- ]?time (code|password|pin)|verification code|verify your (email|account)|confirm your email|sign[- ]?in code|your code is/.test(t)) return "verification";
  if (/reminder|don'?t forget|deadline|expires|complete your application|action required/.test(t)) return "reminder";
  return "other";
}

export type InboxItem = {
  id: string;
  fromName: string;
  fromAddr: string;
  subject: string;
  snippet: string;
  date: number;
  category: InboxCategory;
};

function header(headers: { name?: string; value?: string }[] | undefined, name: string): string {
  return headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? "";
}

function parseFrom(from: string): { name: string; addr: string } {
  const m = from.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  if (m) return { name: m[1].trim() || m[2], addr: m[2].trim() };
  return { name: from.trim(), addr: from.trim() };
}

// List recent job-related emails (metadata only — fast). Bodies are fetched lazily
// when a message is opened. Returns [] if Gmail isn't connected/active.
export async function listJobMessages(userId: string, max = 30): Promise<InboxItem[]> {
  const token = await getValidAccessToken(userId);
  if (!token) return [];
  const q = 'newer_than:30d (interview OR assessment OR "thank you for applying" OR application OR offer OR recruiter OR position OR "verification code" OR reminder OR "next steps" OR candidate)';
  const listRes = await fetch(`${GMAIL_API}/messages?maxResults=${max}&q=${encodeURIComponent(q)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!listRes.ok) return [];
  const list = (await listRes.json()) as { messages?: { id: string }[] };
  const ids = (list.messages ?? []).map((m) => m.id);

  const items = await Promise.all(
    ids.map(async (id) => {
      const r = await fetch(`${GMAIL_API}/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) return null;
      const m = (await r.json()) as { snippet?: string; internalDate?: string; payload?: { headers?: { name?: string; value?: string }[] } };
      const subject = header(m.payload?.headers, "Subject");
      const { name, addr } = parseFrom(header(m.payload?.headers, "From"));
      const snippet = m.snippet ?? "";
      return {
        id,
        fromName: name,
        fromAddr: addr,
        subject,
        snippet,
        date: m.internalDate ? Number(m.internalDate) : 0,
        category: classifyEmail(`${subject} ${snippet}`),
      } satisfies InboxItem;
    }),
  );
  return items.filter((x): x is InboxItem => !!x).sort((a, b) => b.date - a.date);
}

// Full readable body of one message (read live; not stored).
export async function getMessageBody(userId: string, id: string): Promise<{ subject: string; from: string; date: number; body: string } | null> {
  const token = await getValidAccessToken(userId);
  if (!token) return null;
  const r = await fetch(`${GMAIL_API}/messages/${id}?format=full`, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) return null;
  const m = (await r.json()) as { snippet?: string; internalDate?: string; payload?: GmailPart & { headers?: { name?: string; value?: string }[] } };
  const text = collectText(m.payload).replace(/<[^>]+>/g, " ").replace(/\n{3,}/g, "\n\n").trim() || m.snippet || "";
  return {
    subject: header(m.payload?.headers, "Subject"),
    from: header(m.payload?.headers, "From"),
    date: m.internalDate ? Number(m.internalDate) : 0,
    body: text,
  };
}

// Search the user's recent mail for an OTP / verification link.
export async function findVerification(
  userId: string,
  query = "newer_than:1d (code OR verification OR verify OR confirm OR otp)",
): Promise<OtpResult & { found: boolean }> {
  const token = await getValidAccessToken(userId);
  if (!token) return { found: false, code: null, links: [] };

  const listRes = await fetch(`${GMAIL_API}/messages?maxResults=10&q=${encodeURIComponent(query)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!listRes.ok) return { found: false, code: null, links: [] };
  const list = (await listRes.json()) as { messages?: { id: string }[] };

  for (const { id } of list.messages ?? []) {
    const msgRes = await fetch(`${GMAIL_API}/messages/${id}?format=full`, { headers: { Authorization: `Bearer ${token}` } });
    if (!msgRes.ok) continue;
    const msg = (await msgRes.json()) as { payload?: GmailPart; snippet?: string };
    const text = collectText(msg.payload) || msg.snippet || "";
    const res = extractOtp(text);
    if (res.code || res.links.length) return { found: true, ...res };
  }
  return { found: false, code: null, links: [] };
}
