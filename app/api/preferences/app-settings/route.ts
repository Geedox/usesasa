import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/get-session";
import { db } from "@/lib/db";
import { preferences } from "@/lib/db/schema";

const OPT = ["off", "honest", "aggressive"];
const ALLOWED = new Set([
  "resumeOptimization",
  "resumeAutoApprove",
  "coverLetterOptimization",
  "coverLetterAutoApprove",
  "allowEmbellishment",
]);

// Merge a partial applicationSettings patch into preferences.onboarding.applicationSettings.
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const { patch } = (await req.json().catch(() => ({}))) as { patch?: Record<string, unknown> };
  if (!patch || typeof patch !== "object") {
    return NextResponse.json({ error: "Missing patch." }, { status: 400 });
  }

  // Validate keys/values.
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch)) {
    if (!ALLOWED.has(k)) continue;
    if (k.endsWith("Optimization")) {
      if (typeof v === "string" && OPT.includes(v)) clean[k] = v;
    } else if (typeof v === "boolean") {
      clean[k] = v;
    }
  }
  if (Object.keys(clean).length === 0) {
    return NextResponse.json({ error: "Nothing valid to update." }, { status: 400 });
  }

  const existing = await db.query.preferences.findFirst({ where: eq(preferences.userId, session.user.id) });
  const onboarding = (existing?.onboarding as Record<string, unknown> | null) ?? {};
  const appSettings = (onboarding.applicationSettings as Record<string, unknown> | undefined) ?? {};
  const nextOnboarding = { ...onboarding, applicationSettings: { ...appSettings, ...clean } };

  await db
    .insert(preferences)
    .values({ userId: session.user.id, onboarding: nextOnboarding })
    .onConflictDoUpdate({ target: preferences.userId, set: { onboarding: nextOnboarding } });

  return NextResponse.json({ ok: true, applicationSettings: nextOnboarding.applicationSettings });
}
