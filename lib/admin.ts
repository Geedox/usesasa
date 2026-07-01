import { getSession } from "@/lib/get-session";

// Admins are an env allowlist (comma-separated emails). The secret admin URL is
// obscurity; this email check is the real gate. Defaults to the founder.
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "samuel@engramiq.com")
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
