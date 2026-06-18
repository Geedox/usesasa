import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { getSession } from "@/lib/get-session";
import { db } from "@/lib/db";
import { profiles, users, preferences } from "@/lib/db/schema";
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";

export default async function OnboardingPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  // Already finished onboarding -> dashboard.
  const user = await db.query.users.findFirst({ where: eq(users.id, session.user.id) });
  if (user?.onboardedAt) redirect("/dashboard");

  // Resume into the wizard if a CV is already uploaded; otherwise start at upload.
  const profile = await db.query.profiles.findFirst({
    where: and(eq(profiles.userId, session.user.id), eq(profiles.isCurrent, true)),
  });

  // Restore any autosaved wizard answers + the step the user was on.
  const prefs = await db.query.preferences.findFirst({
    where: eq(preferences.userId, session.user.id),
  });
  const saved = (prefs?.onboarding as (Record<string, unknown> & { _step?: number }) | null) ?? null;
  const savedStep = typeof saved?._step === "number" ? saved._step : 0;

  return (
    <OnboardingFlow
      hasCv={!!profile}
      parsed={!!profile?.parsedData}
      saved={saved}
      savedStep={savedStep}
    />
  );
}
