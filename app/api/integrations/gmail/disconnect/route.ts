import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/get-session";
import { db } from "@/lib/db";
import { preferences } from "@/lib/db/schema";

// Toggle whether Sasa reads the user's Gmail. The gmail.readonly grant lives on the
// Better Auth Google account; we don't revoke it here (that would also unlink login).
// Instead we flip a flag so Sasa stops scanning. To fully revoke, the user removes
// access in their Google Account permissions. Body: { enabled: boolean }.
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const { enabled } = (await req.json().catch(() => ({}))) as { enabled?: boolean };
  const gmailEnabled = enabled === true;

  const existing = await db.query.preferences.findFirst({ where: eq(preferences.userId, session.user.id) });
  const onboarding = (existing?.onboarding as Record<string, unknown> | null) ?? {};
  const emailNotifications = (onboarding.emailNotifications as Record<string, unknown> | undefined) ?? {};
  const nextOnboarding = { ...onboarding, emailNotifications: { ...emailNotifications, gmailEnabled } };

  await db
    .insert(preferences)
    .values({ userId: session.user.id, onboarding: nextOnboarding })
    .onConflictDoUpdate({ target: preferences.userId, set: { onboarding: nextOnboarding } });

  return NextResponse.json({ ok: true, gmailEnabled });
}
