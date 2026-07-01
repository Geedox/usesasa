import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { getSession } from "@/lib/get-session";
import { db } from "@/lib/db";
import { profiles, preferences } from "@/lib/db/schema";
import { normalizeProfile } from "@/lib/profile";
import { cloudinary } from "@/lib/cloudinary";
import { ProfileView } from "@/components/profile/profile-view";
import { ProfileProcessing } from "@/components/profile/profile-processing";

export default async function ProfilePage() {
  const session = await getSession();
  if (!session) return null;

  const profile = await db.query.profiles.findFirst({
    where: and(eq(profiles.userId, session.user.id), eq(profiles.isCurrent, true)),
  });

  if (!profile) {
    return (
      <main className="max-w-3xl mx-auto px-6 lg:px-10 py-24 text-center">
        <h1 className="font-display text-2xl tracking-tight mb-2">No CV yet</h1>
        <p className="text-muted-foreground mb-6">Upload your CV to build your profile.</p>
        <Link href="/onboarding" className="rounded-lg bg-foreground text-background px-5 py-2.5 text-sm">
          Upload your CV
        </Link>
      </main>
    );
  }

  if (!profile.parsedData) return <ProfileProcessing />;

  const prefs = await db.query.preferences.findFirst({
    where: eq(preferences.userId, session.user.id),
  });

  const resumeUrl = profile.cvStoragePath
    ? cloudinary.url(profile.cvStoragePath, {
        resource_type: "raw",
        type: "authenticated",
        sign_url: true,
        secure: true,
      })
    : null;

  return (
    <ProfileView
      profile={normalizeProfile(profile.parsedData)}
      onboarding={(prefs?.onboarding as never) ?? null}
      resumeUrl={resumeUrl}
    />
  );
}
