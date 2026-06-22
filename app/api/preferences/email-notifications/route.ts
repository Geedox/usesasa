import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/get-session";
import { db } from "@/lib/db";
import { preferences } from "@/lib/db/schema";

const BOOL = new Set(["jobRecommendations", "productUpdates"]);

// Merge a partial email-notification patch into preferences.onboarding.emailNotifications.
// Fields: jobRecommendations (bool), productUpdates (bool), pausedUntil (ISO string|null),
// timezone (string).
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const { patch } = (await req.json().catch(() => ({}))) as { patch?: Record<string, unknown> };
  if (!patch || typeof patch !== "object") return NextResponse.json({ error: "Missing patch." }, { status: 400 });

  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch)) {
    if (BOOL.has(k) && typeof v === "boolean") clean[k] = v;
    else if (k === "timezone" && typeof v === "string") clean[k] = v.slice(0, 64);
    else if (k === "pausedUntil") clean[k] = v === null ? null : typeof v === "string" ? v.slice(0, 40) : undefined;
  }
  if (Object.keys(clean).length === 0) return NextResponse.json({ error: "Nothing valid to update." }, { status: 400 });

  const existing = await db.query.preferences.findFirst({ where: eq(preferences.userId, session.user.id) });
  const onboarding = (existing?.onboarding as Record<string, unknown> | null) ?? {};
  const current = (onboarding.emailNotifications as Record<string, unknown> | undefined) ?? {};
  const nextOnboarding = { ...onboarding, emailNotifications: { ...current, ...clean } };

  await db
    .insert(preferences)
    .values({ userId: session.user.id, onboarding: nextOnboarding })
    .onConflictDoUpdate({ target: preferences.userId, set: { onboarding: nextOnboarding } });

  return NextResponse.json({ ok: true, emailNotifications: nextOnboarding.emailNotifications });
}
