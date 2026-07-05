import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/get-session";
import { db } from "@/lib/db";
import { preferences } from "@/lib/db/schema";

// The contact/social links the autofill fills when a form asks for them. Merged into
// preferences.onboarding.contact (same place onboarding stores linkedin/github/etc.).
const FIELDS = new Set(["linkedin", "github", "portfolio", "twitter", "facebook", "instagram"]);

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const { patch } = (await req.json().catch(() => ({}))) as { patch?: Record<string, unknown> };
  if (!patch || typeof patch !== "object") return NextResponse.json({ error: "Missing patch." }, { status: 400 });

  const clean: Record<string, string> = {};
  for (const [k, v] of Object.entries(patch)) {
    if (FIELDS.has(k) && typeof v === "string") clean[k] = v.trim().slice(0, 300);
  }
  if (Object.keys(clean).length === 0) return NextResponse.json({ error: "Nothing valid to update." }, { status: 400 });

  const existing = await db.query.preferences.findFirst({ where: eq(preferences.userId, session.user.id) });
  const onboarding = (existing?.onboarding as Record<string, unknown> | null) ?? {};
  const contact = (onboarding.contact as Record<string, unknown> | undefined) ?? {};
  const nextOnboarding = { ...onboarding, contact: { ...contact, ...clean } };

  await db
    .insert(preferences)
    .values({ userId: session.user.id, onboarding: nextOnboarding })
    .onConflictDoUpdate({ target: preferences.userId, set: { onboarding: nextOnboarding } });

  return NextResponse.json({ ok: true });
}
