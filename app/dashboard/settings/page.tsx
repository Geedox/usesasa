import { eq, and, desc, count } from "drizzle-orm";
import { headers } from "next/headers";
import { SettingsLayout, type ApplySettings } from "@/components/settings/settings-layout";
import type { EmailNotifications } from "@/components/settings/email-integrations";
import { getSession } from "@/lib/get-session";
import { db } from "@/lib/db";
import { users, preferences, accounts, creditLedger } from "@/lib/db/schema";
import { getBalance } from "@/lib/credits";
import { PACKS, paystackConfigured } from "@/lib/paystack";
import { PLANS } from "@/lib/plans";
import { getEntitlement, isSubscriber } from "@/lib/subscription";
import { referralSummary } from "@/lib/referral";
import { SITE_URL } from "@/lib/site";

const DEFAULT_APPLY: ApplySettings = {
  resumeOptimization: "honest",
  resumeAutoApprove: false,
  coverLetterOptimization: "honest",
  coverLetterAutoApprove: false,
  allowEmbellishment: false,
};

const TX_PAGE_SIZE = 10;

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string; txPage?: string }> }) {
  const session = await getSession();
  if (!session) return null;

  const { tab, txPage: txPageParam } = await searchParams;
  const txPage = Math.max(1, Number(txPageParam) || 1);

  const [user, prefs, credits, googleAccount] = await Promise.all([
    db.query.users.findFirst({ where: eq(users.id, session.user.id) }),
    db.query.preferences.findFirst({ where: eq(preferences.userId, session.user.id) }),
    getBalance(session.user.id),
    db.query.accounts.findFirst({
      where: and(eq(accounts.userId, session.user.id), eq(accounts.providerId, "google")),
    }),
  ]);

  const onboarding = (prefs?.onboarding as {
    applicationSettings?: Partial<ApplySettings>;
    comp?: { salaryExpectation?: string; salaryPeriod?: string; noticePeriod?: string; yearsExperience?: string };
    emailNotifications?: Partial<EmailNotifications> & { gmailEnabled?: boolean };
  } | null) ?? {};
  const apply: ApplySettings = { ...DEFAULT_APPLY, ...(onboarding.applicationSettings ?? {}) };
  const comp = {
    salaryExpectation: onboarding.comp?.salaryExpectation ?? "",
    salaryPeriod: onboarding.comp?.salaryPeriod ?? "year",
    noticePeriod: onboarding.comp?.noticePeriod ?? "",
    yearsExperience: onboarding.comp?.yearsExperience ?? "",
  };
  const emailNotifications: EmailNotifications = {
    jobRecommendations: onboarding.emailNotifications?.jobRecommendations ?? true,
    productUpdates: onboarding.emailNotifications?.productUpdates ?? true,
    pausedUntil: onboarding.emailNotifications?.pausedUntil ?? null,
    timezone: onboarding.emailNotifications?.timezone ?? prefs?.digestTimezone ?? "Africa/Lagos",
  };

  const gmailHasScope = Boolean(googleAccount?.scope?.includes("gmail.readonly"));
  const gmailEnabled = onboarding.emailNotifications?.gmailEnabled !== false;

  // Billing region: Nigeria pays with credit packs, elsewhere subscribes. Default
  // the billing view from the request country (best-effort header), Nigeria-first.
  const hdrs = await headers();
  const country = (hdrs.get("x-vercel-ip-country") || hdrs.get("cf-ipcountry") || "").toUpperCase();
  const [subscribed, entitlement] = await Promise.all([isSubscriber(session.user.id), getEntitlement(session.user.id)]);
  const defaultBilling: "credits" | "subscription" = subscribed ? "subscription" : country && country !== "NG" ? "subscription" : "credits";

  const [txCountRow] = await db.select({ n: count() }).from(creditLedger).where(eq(creditLedger.userId, session.user.id));
  const txTotalPages = Math.max(1, Math.ceil((txCountRow?.n ?? 0) / TX_PAGE_SIZE));
  const page = Math.min(txPage, txTotalPages);
  const ledger = await db
    .select({ id: creditLedger.id, delta: creditLedger.delta, reason: creditLedger.reason, balanceAfter: creditLedger.balanceAfter, createdAt: creditLedger.createdAt })
    .from(creditLedger)
    .where(eq(creditLedger.userId, session.user.id))
    .orderBy(desc(creditLedger.createdAt))
    .limit(TX_PAGE_SIZE)
    .offset((page - 1) * TX_PAGE_SIZE);
  const transactions = ledger.map((l) => ({ id: l.id, delta: l.delta, reason: l.reason, balanceAfter: l.balanceAfter, at: l.createdAt.toISOString() }));

  const referral = await referralSummary(session.user.id);
  const referralShareUrl = `${SITE_URL}/?ref=${referral.code}`;

  return (
    <SettingsLayout
      apply={apply}
      comp={comp}
      workPrefs={{ arrangements: prefs?.workArrangements ?? [], internshipOnly: prefs?.internshipOnly ?? false }}
      extensionConnected={Boolean(user?.extensionTokenHash)}
      telegramConnected={Boolean(user?.telegramChatId)}
      email={user?.email ?? session.user.email ?? ""}
      credits={credits}
      gmailHasScope={gmailHasScope}
      gmailEnabled={gmailEnabled}
      gmailEmail={user?.email ?? session.user.email ?? null}
      emailNotifications={emailNotifications}
      packs={PACKS}
      plans={PLANS}
      entitlement={subscribed ? entitlement : null}
      transactions={transactions}
      txPage={page}
      txTotalPages={txTotalPages}
      referral={referral}
      referralShareUrl={referralShareUrl}
      defaultBilling={defaultBilling}
      paymentsEnabled={paystackConfigured()}
      initialSection={tab}
    />
  );
}
