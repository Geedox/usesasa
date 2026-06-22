import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { profiles, preferences } from "@/lib/db/schema";
import { userFromBearer } from "@/lib/extension-auth";
import { normalizeProfile } from "@/lib/profile";
import { cloudinary } from "@/lib/cloudinary";

// The user's base profile for the universal autofill widget — used to prefill any
// job application form on the web, independent of our discovered-jobs queue. Returns
// just the contact fields + signed resume URL; no application record, no charge
// (prefill is free; a credit is only spent when an application is actually submitted).
export async function GET(req: Request) {
  const user = await userFromBearer(req);
  if (!user) return NextResponse.json({ error: "Invalid token." }, { status: 401 });

  const profileRow = await db.query.profiles.findFirst({
    where: and(eq(profiles.userId, user.id), eq(profiles.isCurrent, true)),
  });
  const profile = profileRow?.parsedData ? normalizeProfile(profileRow.parsedData) : null;
  const resumeUrl = profileRow?.cvStoragePath
    ? cloudinary.url(profileRow.cvStoragePath, { resource_type: "raw", type: "authenticated", sign_url: true, secure: true })
    : null;
  const [firstName, ...rest] = (profile?.full_name ?? user.name ?? "").trim().split(/\s+/);

  const prefsRow = await db.query.preferences.findFirst({ where: eq(preferences.userId, user.id) });
  const contact = (prefsRow?.onboarding as { contact?: { phone?: string; linkedin?: string; github?: string; portfolio?: string } } | null)?.contact ?? {};

  return NextResponse.json({
    fields: {
      firstName: firstName ?? "",
      lastName: rest.join(" "),
      email: profile?.email ?? user.email,
      phone: profile?.phone || contact.phone || "",
      linkedin: profile?.links.linkedin || contact.linkedin || "",
      github: profile?.links.github || contact.github || "",
      portfolio: profile?.links.portfolio || contact.portfolio || "",
    },
    resumeUrl,
    hasProfile: !!profile,
  });
}
