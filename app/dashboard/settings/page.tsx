import { eq } from "drizzle-orm";
import { SettingsLayout, type ApplySettings } from "@/components/settings/settings-layout";
import { getSession } from "@/lib/get-session";
import { db } from "@/lib/db";
import { users, preferences } from "@/lib/db/schema";
import { getBalance } from "@/lib/credits";

const DEFAULT_APPLY: ApplySettings = {
  resumeOptimization: "honest",
  resumeAutoApprove: false,
  coverLetterOptimization: "honest",
  coverLetterAutoApprove: false,
  allowEmbellishment: false,
};

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) return null;

  const [user, prefs, credits] = await Promise.all([
    db.query.users.findFirst({ where: eq(users.id, session.user.id) }),
    db.query.preferences.findFirst({ where: eq(preferences.userId, session.user.id) }),
    getBalance(session.user.id),
  ]);

  const saved = (prefs?.onboarding as { applicationSettings?: Partial<ApplySettings> } | null)?.applicationSettings ?? {};
  const apply: ApplySettings = { ...DEFAULT_APPLY, ...saved };

  return (
    <SettingsLayout
      apply={apply}
      extensionConnected={Boolean(user?.extensionTokenHash)}
      telegramConnected={Boolean(user?.telegramChatId)}
      email={user?.email ?? session.user.email ?? ""}
      credits={credits}
    />
  );
}
