import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/get-session";
import { db } from "@/lib/db";
import { preferences } from "@/lib/db/schema";

// Toggle whether the agent may add skills the user did not list (default off).
// Merges into preferences.onboarding.applicationSettings.allowEmbellishment.
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const { enabled } = (await req.json().catch(() => ({}))) as { enabled?: boolean };
  if (typeof enabled !== "boolean") {
    return NextResponse.json({ error: "Missing 'enabled'." }, { status: 400 });
  }

  const existing = await db.query.preferences.findFirst({ where: eq(preferences.userId, session.user.id) });
  const onboarding = (existing?.onboarding as Record<string, unknown> | null) ?? {};
  const appSettings = (onboarding.applicationSettings as Record<string, unknown> | undefined) ?? {};
  const nextOnboarding = {
    ...onboarding,
    applicationSettings: { ...appSettings, allowEmbellishment: enabled },
  };

  await db
    .insert(preferences)
    .values({ userId: session.user.id, onboarding: nextOnboarding })
    .onConflictDoUpdate({ target: preferences.userId, set: { onboarding: nextOnboarding } });

  return NextResponse.json({ ok: true, enabled });
}
