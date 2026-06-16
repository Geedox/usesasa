// Central place for site-wide SEO constants. Set NEXT_PUBLIC_SITE_URL in your
// environment (Railway / Vercel) to your real domain so canonical + OG URLs are correct.
// A bare domain (e.g. "usesasa.com" or "*.up.railway.app") is accepted and normalized —
// it must never throw, because it feeds `new URL(...)` in metadataBase at build time.
function resolveSiteUrl(): string {
  const fallback = "https://usesasa.xyz";
  let raw = (process.env.NEXT_PUBLIC_SITE_URL || "").trim();
  if (!raw) return fallback;
  if (!/^https?:\/\//i.test(raw)) raw = `https://${raw}`;
  try {
    return new URL(raw).origin;
  } catch {
    return fallback;
  }
}

export const SITE_URL = resolveSiteUrl();

export const SITE_NAME = "Sasa";

export const SITE_TITLE = "Sasa — Apply to every job that fits you. Hands off.";

export const SITE_DESCRIPTION =
  "Sasa is an AI job-application agent for busy African professionals. It watches Greenhouse, Lever & Ashby career pages, tailors your CV and cover letter per role, applies from your own browser, and pings you on WhatsApp — while you keep your day job.";

export const SITE_KEYWORDS = [
  "AI job application agent",
  "auto apply to jobs",
  "job application automation",
  "tailored CV and cover letter",
  "japa tech jobs",
  "remote jobs for Africans",
  "UK visa sponsorship jobs",
  "Canada Express Entry tech jobs",
  "Nigeria tech jobs",
  "apply to jobs on WhatsApp",
  "Greenhouse Lever Ashby auto apply",
  "Sasa",
];

export const CONTACT_EMAIL = "founders@usesasa.xyz";
