import { getSession } from "@/lib/get-session";

// Admins are an env allowlist (comma-separated emails). The secret admin URL is
// obscurity; this email check is the real gate. Set ADMIN_EMAILS to override the
// default team below.
const DEFAULT_ADMIN_EMAILS = "usotex@gmail.com,usorohdev@gmail.com,onahjonah@gmail.com";
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || DEFAULT_ADMIN_EMAILS)
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export function isAdminEmail(email: string | null | undefined): boolean {
  return !!email && ADMIN_EMAILS.includes(email.toLowerCase());
}

// Returns the admin session, or null if the caller is not an admin. Use in admin
// pages (redirect/notFound on null) and API routes (401/403 on null).
export async function getAdminSession() {
  const session = await getSession();
  if (!session || !isAdminEmail(session.user.email)) return null;
  return session;
}
