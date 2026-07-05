import { SITE_URL } from "@/lib/site";

// Minimal transactional email via Resend.
export async function sendEmail({
  to,
  subject,
  text,
  html,
}: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  const fromRaw = process.env.EMAIL_FROM ?? "onboarding@resend.dev";
  const from = fromRaw.includes("<") ? fromRaw : `Sasa <${fromRaw}>`;

  if (!apiKey) {
    console.warn(`[email] RESEND_API_KEY not set. Not sending "${subject}" to ${to}`);
    return { sent: false };
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [to], subject, text, ...(html ? { html } : {}) }),
  });

  if (!res.ok) {
    console.error("[email] send failed:", res.status, await res.text());
    return { sent: false };
  }
  return { sent: true };
}

// Plain welcome email (no colors or branding, just a normal note).
// One time code email for email verification and password reset.
export function buildOtpEmail(otp: string, type: "email-verification" | "forget-password" | "sign-in" | "change-email") {
  const reset = type === "forget-password";
  const subject = reset ? "Reset your Sasa password" : "Your Sasa verification code";
  const intro = reset
    ? "Use this code to reset your Sasa password."
    : "Use this code to verify your email and finish setting up Sasa.";

  const text = `${intro}

Your code is: ${otp}

It expires in 10 minutes. If you did not request this, you can ignore this email.

The Sasa team`;

  const html = `<div style="font-family: ui-sans-serif, system-ui, Segoe UI, Roboto, Helvetica, Arial, sans-serif; font-size: 15px; line-height: 1.6; max-width: 560px;">
  <p>${intro}</p>
  <p style="font-size: 30px; font-weight: 700; letter-spacing: 6px; margin: 16px 0;">${otp}</p>
  <p style="color: #666;">It expires in 10 minutes. If you did not request this, you can ignore this email.</p>
  <p>The Sasa team</p>
</div>`;

  return { subject, text, html };
}

const EXTENSION_URL = "https://chromewebstore.google.com/detail/sasa/pcpbinadolndiebjjoidnjbnmkfjllif";
const WALKTHROUGH_URL = "https://youtu.be/qd5kcNAfHj0";

export function buildWelcomeEmail(name?: string | null) {
  const first = name?.trim().split(" ")[0] || "there";
  const dashboard = `${SITE_URL}/dashboard`;

  const subject = "Welcome to Sasa";

  const text = `Hi ${first},

Welcome to Sasa. You're in.

Sasa applies to jobs on your behalf while you keep your day job. Here's what happens next:

1. Tell us about you. Upload your CV and set your target roles, locations, and sponsorship needs.
2. We watch the career pages and surface roles that fit you, the moment they go live.
3. You approve and we apply. A tailored CV and cover letter for each role, submitted from your own browser.

Open your dashboard: ${dashboard}

Watch the product walkthrough: ${WALKTHROUGH_URL}
Get the Chrome extension: ${EXTENSION_URL}

If you have any questions, just reply to this email. A real founder will read it.

The Sasa team`;

  const html = `<div style="font-family: ui-sans-serif, system-ui, Segoe UI, Roboto, Helvetica, Arial, sans-serif; font-size: 15px; line-height: 1.6; max-width: 560px;">
  <p>Hi ${first},</p>
  <p>Welcome to Sasa. You're in.</p>
  <p>Sasa applies to jobs on your behalf while you keep your day job. Here's what happens next:</p>
  <ol>
    <li>Tell us about you. Upload your CV and set your target roles, locations, and sponsorship needs.</li>
    <li>We watch the career pages and surface roles that fit you, the moment they go live.</li>
    <li>You approve and we apply. A tailored CV and cover letter for each role, submitted from your own browser.</li>
  </ol>
  <p><a href="${dashboard}">Open your dashboard</a></p>
  <p style="margin: 20px 0;">
    <a href="${WALKTHROUGH_URL}" style="display: inline-block; margin-right: 18px;">Watch the product walkthrough</a>
    <a href="${EXTENSION_URL}">Get the Chrome extension</a>
  </p>
  <p>If you have any questions, just reply to this email. A real founder will read it.</p>
  <p>The Sasa team</p>
</div>`;

  return { subject, text, html };
}
