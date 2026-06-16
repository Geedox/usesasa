import { NextResponse } from "next/server";

// Where beta signups are delivered.
const TO_EMAIL = "usorohdev@gmail.com";
// Sender. Uses EMAIL_FROM if set (its domain must be verified in Resend),
// otherwise falls back to Resend's test sender (only delivers to the account owner).
const FROM_EMAIL = process.env.EMAIL_FROM
  ? process.env.EMAIL_FROM.includes("<")
    ? process.env.EMAIL_FROM
    : `Sasa Beta <${process.env.EMAIL_FROM}>`
  : "Sasa Beta <onboarding@resend.dev>";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type SignupPayload = {
  fullName?: string;
  email?: string;
  okWithPricing?: "yes" | "no";
  pricingFeedback?: string;
  phone?: string;
  platforms?: string[];
};

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function POST(req: Request) {
  let data: SignupPayload;
  try {
    data = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const fullName = (data.fullName || "").trim();
  const email = (data.email || "").trim();
  const phone = (data.phone || "").trim();
  const platforms = Array.isArray(data.platforms) ? data.platforms : [];
  const okWithPricing = data.okWithPricing;
  const pricingFeedback = (data.pricingFeedback || "").trim();

  // Server-side validation (mirror of the client checks).
  if (!fullName) return NextResponse.json({ error: "Full name is required." }, { status: 400 });
  if (!EMAIL_RE.test(email)) return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
  if (okWithPricing !== "yes" && okWithPricing !== "no")
    return NextResponse.json({ error: "Pricing answer is required." }, { status: 400 });
  if (okWithPricing === "no" && !pricingFeedback)
    return NextResponse.json({ error: "Pricing feedback is required." }, { status: 400 });
  if (!phone) return NextResponse.json({ error: "Phone number is required." }, { status: 400 });
  if (platforms.length === 0)
    return NextResponse.json({ error: "Pick at least one contact platform." }, { status: 400 });

  const subject = `New Sasa beta signup — ${fullName}`;
  const lines = [
    ["Full name", fullName],
    ["Email", email],
    ["Phone", phone],
    ["Reachable on", platforms.join(", ")],
    ["Okay with pricing?", okWithPricing],
    ...(okWithPricing === "no" ? [["Pricing feedback", pricingFeedback]] : []),
  ] as [string, string][];

  const html = `
    <h2 style="font-family:sans-serif;">New Sasa beta signup</h2>
    <table style="font-family:sans-serif;font-size:14px;border-collapse:collapse;">
      ${lines
        .map(
          ([k, v]) =>
            `<tr><td style="padding:6px 16px 6px 0;color:#666;vertical-align:top;"><strong>${escapeHtml(
              k
            )}</strong></td><td style="padding:6px 0;">${escapeHtml(v)}</td></tr>`
        )
        .join("")}
    </table>
  `;
  const text = lines.map(([k, v]) => `${k}: ${v}`).join("\n");

  const apiKey = process.env.RESEND_API_KEY;

  // Graceful fallback: if email isn't configured yet, log the submission so it
  // isn't lost and the UX still works. Set RESEND_API_KEY to actually deliver.
  if (!apiKey) {
    console.warn("[beta-signup] RESEND_API_KEY not set — submission not emailed:\n" + text);
    return NextResponse.json({ ok: true, emailed: false });
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [TO_EMAIL],
        reply_to: email,
        subject,
        html,
        text,
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      console.error("[beta-signup] Resend error:", res.status, errBody);
      return NextResponse.json({ error: "Could not send your signup. Please try again." }, { status: 502 });
    }

    return NextResponse.json({ ok: true, emailed: true });
  } catch (err) {
    console.error("[beta-signup] Email request failed:", err);
    return NextResponse.json({ error: "Could not send your signup. Please try again." }, { status: 502 });
  }
}
