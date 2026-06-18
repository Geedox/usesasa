import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { getSession } from "@/lib/get-session";
import { db } from "@/lib/db";
import { profiles } from "@/lib/db/schema";
import { normalizeProfile } from "@/lib/profile";
import { ProfileEditor } from "@/components/profile/profile-editor";

export default async function ProfileEditPage() {
  const session = await getSession();
  if (!session) return null;

  const profile = await db.query.profiles.findFirst({
    where: and(eq(profiles.userId, session.user.id), eq(profiles.isCurrent, true)),
  });

  // Nothing to edit until a CV is parsed.
  if (!profile?.parsedData) redirect("/dashboard/profile");

  return <ProfileEditor initial={normalizeProfile(profile.parsedData)} />;
}
