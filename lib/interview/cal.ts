import { createHmac, timingSafeEqual } from "node:crypto";

// Self-hosted Cal.com config. The origin is the base URL of your Cal instance
// (e.g. https://cal.usesasa.xyz); the embed and booking links hang off it. The
// webhook secret is what verifies inbound BOOKING_* events are really from Cal.
export const CAL_ORIGIN = (process.env.NEXT_PUBLIC_CAL_ORIGIN || "").replace(/\/$/, "");
// The single shared Interview Prep event everyone books; the mentor is assigned by
// an admin afterward (the booking does not route to a specific mentor's calendar).
export const CAL_SHARED_LINK = process.env.NEXT_PUBLIC_CAL_LINK || "";
const CAL_WEBHOOK_SECRET = process.env.CAL_WEBHOOK_SECRET || "";

export function calConfigured(): boolean {
  return CAL_ORIGIN.length > 0 && CAL_SHARED_LINK.length > 0;
}

// Cal.com signs the webhook body with HMAC-SHA256 (hex) in X-Cal-Signature-256.
// Returns true if the signature matches — or if no secret is configured (dev).
export function verifyCalSignature(rawBody: string, signature: string | null): boolean {
  if (!CAL_WEBHOOK_SECRET) return true; // not enforced until a secret is set
  if (!signature) return false;
  const expected = createHmac("sha256", CAL_WEBHOOK_SECRET).update(rawBody, "utf8").digest("hex");
  try {
    const a = Buffer.from(expected, "hex");
    const b = Buffer.from(signature, "hex");
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

// Cal puts the meeting link in different places depending on the location type
// (built-in Cal Video, Google Meet, Zoom, a custom link). Probe the common ones.
export function extractMeetingUrl(payload: Record<string, unknown>): string | null {
  const video = payload.videoCallData as { url?: string } | undefined;
  if (video?.url) return video.url;
  const meta = payload.metadata as { videoCallUrl?: string } | undefined;
  if (meta?.videoCallUrl) return meta.videoCallUrl;
  const loc = payload.location;
  if (typeof loc === "string" && /^https?:\/\//i.test(loc)) return loc;
  // No real provider URL (e.g. Cal Video with no provider configured sends
  // `location: "integrations:daily"` + null videoCallData). The caller falls back to
  // a generated Jitsi room — see jitsiRoomUrl.
  return null;
}

// A unique, always-available Jitsi meeting room for a booking. No API keys or Cal
// video provider needed: the room is created on first join. The booking uuid keeps
// the room name unguessable, so only people we share the link with can join.
export function jitsiRoomUrl(bookingId: string): string {
  return `https://meet.jit.si/sasa-interview-${bookingId}`;
}

// Our booking id is round-tripped through Cal so the webhook can match a Cal booking
// back to the pending row we created. Cal's embed mangles custom `metadata` objects
// (they arrive as {"a":"[object Object]"}), so the reliable channel is a hidden
// marker we add to the booking notes — which round-trips verbatim. We still check
// metadata first in case a future Cal version forwards it correctly.
export function extractSasaBookingId(payload: Record<string, unknown>): string | null {
  const meta = payload.metadata as Record<string, unknown> | undefined;
  const direct = meta?.sasaBookingId;
  if (typeof direct === "string" && direct.length > 0) return direct;
  try {
    const m = JSON.stringify(payload).match(/\[sasa:([0-9a-fA-F-]{36})\]/);
    if (m) return m[1];
  } catch {
    /* ignore */
  }
  return null;
}

// The booker's email, used as a fallback to match a pending booking when no marker
// is present. Cal puts it in responses.email (string or {value}) or attendees[0].
export function extractAttendeeEmail(payload: Record<string, unknown>): string | null {
  const responses = payload.responses as Record<string, unknown> | undefined;
  const re = responses?.email as unknown;
  const fromResp = typeof re === "string" ? re : (re as { value?: string })?.value;
  if (typeof fromResp === "string" && fromResp.includes("@")) return fromResp.toLowerCase();
  const attendees = payload.attendees as { email?: string }[] | undefined;
  const fromAtt = attendees?.[0]?.email;
  if (typeof fromAtt === "string" && fromAtt.includes("@")) return fromAtt.toLowerCase();
  return null;
}

// A Cal-hosted page where the attendee can reschedule or cancel an existing booking.
export function calManageUrl(uid: string): string {
  return `${CAL_ORIGIN}/booking/${uid}`;
}
