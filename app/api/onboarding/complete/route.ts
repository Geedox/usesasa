import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { getSession } from "@/lib/get-session";
import { db } from "@/lib/db";
import { preferences, users } from "@/lib/db/schema";
import { encryptSecret } from "@/lib/crypto";
import { enqueueScoreUser } from "@/lib/queue";
import { enqueueCrawlAll } from "@/lib/discovery/cycle";
import { consumeSignupReferral } from "@/lib/referral";
import { chargeForOnboarding } from "@/lib/credits";

// Persists the onboarding wizard answers and marks the user onboarded.
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const data = await req.json().catch(() => null);
  if (!data || typeof data !== "object") {
    return NextResponse.json({ error: "Invalid body." }, { status: 400 });
  }

  const userId = session.user.id;
  const { applicationPassword, finalize, ...onboarding } = data as Record<string, unknown> & {
    applicationPassword?: string;
    finalize?: boolean;
  };

  // Encrypt the application password if provided (Constitution IV).
  const applicationPasswordEnc =
    typeof applicationPassword === "string" && applicationPassword.length > 0
      ? encryptSecret(applicationPassword)
      : undefined;

  // Map a couple of fields onto first-class preference columns for the matcher.
  const elig = (onboarding as { workEligibility?: { needsSponsorship?: boolean; sponsorshipCountries?: string[] } })
    .workEligibility;

  const row = {
    userId,
    onboarding,
    needsSponsorship: elig?.needsSponsorship ?? null,
    sponsorshipCountries: elig?.sponsorshipCountries ?? null,
    ...(applicationPasswordEnc ? { applicationPasswordEnc } : {}),
  };

  await db
    .insert(preferences)
    .values(row)
    .onConflictDoUpdate({ target: preferences.userId, set: row });

  // Only mark onboarded on the final step (autosaves pass finalize=false).
  if (finalize === true) {
    await db.update(users).set({ onboardedAt: new Date() }).where(eq(users.id, userId));

    // Take the one-off onboarding fee (covers the CV parse). Idempotent + best effort:
    // a hiccup here must not fail onboarding.
    await chargeForOnboarding(userId).catch((err) => console.error("[onboarding] credit charge failed:", err));

    // Reward the referrer (+5, once) if this user signed up with a referral code.
    try {
      const jar = await cookies();
      const refCode = jar.get("sasa_ref")?.value;
      if (refCode) {
        await consumeSignupReferral(userId, refCode);
        jar.delete("sasa_ref");
      }
    } catch (err) {
      console.error("[referral] signup reward failed:", err);
    }
    // Kick off the first scan now so the dashboard fills in instead of sitting
    // empty, and the user does not wait for the scheduled cron. Best effort: a
    // queue hiccup must not fail onboarding.
    try {
      await enqueueCrawlAll();
      await enqueueScoreUser({ userId }, 15);
    } catch (err) {
      console.error("[onboarding] could not enqueue first scan:", err);
    }
  }

  return NextResponse.json({ ok: true });
}
