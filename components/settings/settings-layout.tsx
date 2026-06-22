"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SlidersHorizontal, Cable, CreditCard, User, Check, LogOut, Mail, Loader2, Gift } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { ConnectExtension } from "@/components/settings/connect-extension";
import { ConnectTelegram } from "@/components/settings/connect-telegram";
import { ProfileDetails, type CompDetails } from "@/components/settings/profile-details";
import { EmailIntegrations, type EmailNotifications } from "@/components/settings/email-integrations";
import { ReferralsPanel, type ReferralSummary } from "@/components/settings/referrals-panel";

export type Pack = { id: string; credits: number; currency: "NGN" | "USD"; amount: number; label: string; popular?: boolean };
export type SubPlan = { id: string; name: string; blurb: string; amount: number; applications: number; popular?: boolean };
export type Entitlement = { planId: string | null; used: number; allowance: number; remaining: number };
export type Tx = { id: string; delta: number; reason: string; balanceAfter: number; at: string };

type Opt = "off" | "honest" | "aggressive";
export type ApplySettings = {
  resumeOptimization: Opt;
  resumeAutoApprove: boolean;
  coverLetterOptimization: Opt;
  coverLetterAutoApprove: boolean;
  allowEmbellishment: boolean;
};

const NAV = [
  { key: "apply", label: "Apply Settings", icon: SlidersHorizontal },
  { key: "integrations", label: "Integrations", icon: Cable },
  { key: "email", label: "Email Integrations", icon: Mail },
  { key: "billing", label: "Plans & Billing", icon: CreditCard },
  { key: "referrals", label: "Referrals", icon: Gift },
  { key: "account", label: "Account", icon: User },
] as const;

type NavKey = (typeof NAV)[number]["key"];

async function patchSettings(patch: Partial<ApplySettings>) {
  await fetch("/api/preferences/app-settings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ patch }),
  });
}

export function SettingsLayout({
  apply: initialApply,
  comp,
  extensionConnected,
  telegramConnected,
  email,
  credits,
  gmailHasScope,
  gmailEnabled,
  gmailEmail,
  emailNotifications,
  packs,
  plans,
  entitlement,
  transactions,
  txPage,
  txTotalPages,
  referral,
  referralShareUrl,
  defaultBilling,
  paymentsEnabled,
  initialSection,
}: {
  apply: ApplySettings;
  comp: CompDetails;
  extensionConnected: boolean;
  telegramConnected: boolean;
  email: string;
  credits: number;
  gmailHasScope: boolean;
  gmailEnabled: boolean;
  gmailEmail: string | null;
  emailNotifications: EmailNotifications;
  packs: Pack[];
  plans: SubPlan[];
  entitlement: Entitlement | null;
  transactions: Tx[];
  txPage: number;
  txTotalPages: number;
  referral: ReferralSummary;
  referralShareUrl: string;
  defaultBilling: "credits" | "subscription";
  paymentsEnabled: boolean;
  initialSection?: string;
}) {
  const [section, setSection] = useState<NavKey>(
    (NAV.some((n) => n.key === initialSection) ? (initialSection as NavKey) : "apply"),
  );

  return (
    <main className="max-w-[1400px] mx-auto px-6 lg:px-10 py-8">
      <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-6">
        {/* Left sub-nav */}
        <aside className="rounded-xl border border-foreground/10 bg-background p-4 h-fit">
          <div className="px-2 pb-3">
            <h1 className="font-display text-2xl tracking-tight">Settings</h1>
            <p className="text-sm text-muted-foreground">Manage your account and integrations</p>
          </div>
          <nav className="flex flex-col gap-1">
            {NAV.map((n) => {
              const active = section === n.key;
              return (
                <button
                  key={n.key}
                  onClick={() => setSection(n.key)}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-left transition-colors cursor-pointer ${
                    active ? "bg-foreground/[0.06] text-foreground font-medium" : "text-muted-foreground hover:text-foreground hover:bg-foreground/[0.03]"
                  }`}
                >
                  <n.icon className="w-4 h-4 shrink-0" />
                  {n.label}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Right panel */}
        <div className="min-w-0">
          {section === "apply" && <ApplyPanel initial={initialApply} comp={comp} />}
          {section === "integrations" && (
            <div className="flex flex-col gap-6">
              <ConnectExtension />
              <ConnectTelegram connected={telegramConnected} />
              {!extensionConnected && (
                <p className="text-xs text-muted-foreground px-1">
                  The extension is required for auto submission. Generate a token above to connect it.
                </p>
              )}
            </div>
          )}
          {section === "email" && (
            <EmailIntegrations hasScope={gmailHasScope} enabled={gmailEnabled} email={gmailEmail} notifications={emailNotifications} />
          )}
          {section === "billing" && (
            <BillingPanel credits={credits} packs={packs} plans={plans} entitlement={entitlement} transactions={transactions} txPage={txPage} txTotalPages={txTotalPages} defaultBilling={defaultBilling} paymentsEnabled={paymentsEnabled} />
          )}
          {section === "referrals" && <ReferralsPanel referral={referral} shareUrl={referralShareUrl} />}
          {section === "account" && <AccountPanel email={email} />}
        </div>
      </div>
    </main>
  );
}

function PanelHeader({ icon: Icon, title, desc }: { icon: typeof User; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-3 mb-6">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-foreground/[0.06] shrink-0">
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <h2 className="font-display text-2xl tracking-tight leading-none mb-1">{title}</h2>
        <p className="text-sm text-muted-foreground">{desc}</p>
      </div>
    </div>
  );
}

const RESUME_OPTS: { value: Opt; title: string; desc: string }[] = [
  { value: "off", title: "Off", desc: "Use your original resume as is" },
  { value: "honest", title: "Honest", desc: "Reorder and highlight relevant experience for each job" },
  { value: "aggressive", title: "Aggressive", desc: "Rewrite and tailor content to match the job description" },
];
const COVER_OPTS: { value: Opt; title: string; desc: string }[] = [
  { value: "off", title: "Off", desc: "Do not generate a cover letter" },
  { value: "honest", title: "Honest", desc: "Tailor tone and emphasis to each job, no fabrication" },
  { value: "aggressive", title: "Aggressive", desc: "Rewrite to closely match the job description" },
];

function ApplyPanel({ initial, comp }: { initial: ApplySettings; comp: CompDetails }) {
  const [s, setS] = useState<ApplySettings>(initial);

  const update = (patch: Partial<ApplySettings>) => {
    setS((prev) => ({ ...prev, ...patch }));
    void patchSettings(patch);
  };

  return (
    <div className="rounded-xl border border-foreground/10 bg-background p-6">
      <PanelHeader icon={SlidersHorizontal} title="Apply Settings" desc="Configure how your applications are submitted" />

      <OptGroup
        title="Resume optimization"
        opts={RESUME_OPTS}
        value={s.resumeOptimization}
        onChange={(v) => update({ resumeOptimization: v })}
        autoApprove={s.resumeAutoApprove}
        onAutoApprove={(v) => update({ resumeAutoApprove: v })}
      />

      <div className="h-6" />

      <OptGroup
        title="Cover letter optimization"
        opts={COVER_OPTS}
        value={s.coverLetterOptimization}
        onChange={(v) => update({ coverLetterOptimization: v })}
        autoApprove={s.coverLetterAutoApprove}
        onAutoApprove={(v) => update({ coverLetterAutoApprove: v })}
      />

      <div className="h-6" />

      {/* Honesty */}
      <div className="rounded-lg border border-foreground/10 overflow-hidden">
        <div className="bg-foreground/[0.03] px-5 py-2 font-mono text-[11px] tracking-widest text-muted-foreground uppercase">
          Honesty
        </div>
        <div className="px-5 py-4 flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium mb-1">Let the agent add skills you have not listed</p>
            <p className="text-sm text-muted-foreground">
              Off by default. The agent uses only your true facts and a fact checker blocks anything it cannot verify.
              Turn on only if you understand that claims you cannot back up in an interview can cost you the offer.
            </p>
          </div>
          <Switch on={s.allowEmbellishment} onToggle={(v) => update({ allowEmbellishment: v })} />
        </div>
      </div>

      <div className="h-6" />

      <ProfileDetails initial={comp} />
    </div>
  );
}

function OptGroup({
  title,
  opts,
  value,
  onChange,
  autoApprove,
  onAutoApprove,
}: {
  title: string;
  opts: { value: Opt; title: string; desc: string }[];
  value: Opt;
  onChange: (v: Opt) => void;
  autoApprove: boolean;
  onAutoApprove: (v: boolean) => void;
}) {
  return (
    <div className="rounded-lg border border-foreground/10 overflow-hidden">
      <div className="bg-foreground/[0.03] px-5 py-2 font-mono text-[11px] tracking-widest text-muted-foreground uppercase">
        {title}
      </div>
      {opts.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            className={`w-full text-left px-5 py-3 flex items-start gap-3 border-t border-foreground/5 cursor-pointer transition-colors ${
              active ? "bg-foreground/[0.03]" : "hover:bg-foreground/[0.02]"
            }`}
          >
            <span className={`mt-0.5 flex h-4 w-4 items-center justify-center rounded-full border ${active ? "border-foreground" : "border-foreground/30"}`}>
              {active && <span className="h-2 w-2 rounded-full bg-foreground" />}
            </span>
            <span>
              <span className="block text-sm font-medium">{o.title}</span>
              <span className="block text-sm text-muted-foreground">{o.desc}</span>
            </span>
          </button>
        );
      })}
      <label className="flex items-center gap-2 px-5 py-3 border-t border-foreground/5 cursor-pointer text-sm">
        <span
          onClick={() => onAutoApprove(!autoApprove)}
          className={`flex h-4 w-4 items-center justify-center rounded border ${autoApprove ? "bg-foreground border-foreground" : "border-foreground/30"}`}
        >
          {autoApprove && <Check className="h-3 w-3 text-background" />}
        </span>
        Auto approve, skip the preview step
      </label>
    </div>
  );
}

function Switch({ on, onToggle }: { on: boolean; onToggle: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      onClick={() => onToggle(!on)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors cursor-pointer ${on ? "bg-foreground" : "bg-foreground/20"}`}
    >
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-background transition-transform ${on ? "translate-x-5" : "translate-x-0.5"}`} />
    </button>
  );
}

const TX_LABEL: Record<string, string> = {
  signup_bonus: "Signup bonus",
  beta_bonus: "Beta bonus",
  paystack_purchase: "Credit purchase",
  tailoring_charge: "CV + cover tailoring",
  application_charge: "Application submitted",
  interview_booking: "Interview prep session",
  interview_refund: "Interview refund",
  refund: "Refund",
  manual_adjustment: "Adjustment",
};

function BillingPanel({
  credits,
  packs,
  plans,
  entitlement,
  transactions,
  txPage,
  txTotalPages,
  defaultBilling,
  paymentsEnabled,
}: {
  credits: number;
  packs: Pack[];
  plans: SubPlan[];
  entitlement: Entitlement | null;
  transactions: Tx[];
  txPage: number;
  txTotalPages: number;
  defaultBilling: "credits" | "subscription";
  paymentsEnabled: boolean;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"credits" | "subscription">(defaultBilling);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const go = async (url: string, body: Record<string, unknown>, id: string) => {
    setError(null);
    setBusy(id);
    try {
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok || !data.url) {
        setError(data.error || "Could not start checkout.");
        setBusy(null);
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("Network error. Please try again.");
      setBusy(null);
    }
  };

  const ngnPacks = packs.filter((p) => p.currency === "NGN");

  return (
    <div className="rounded-xl border border-foreground/10 bg-background p-6">
      <PanelHeader icon={CreditCard} title="Plans & Billing" desc="Pay for the applications, not the tool" />

      {/* Region toggle */}
      <div className="flex gap-2 mb-6">
        <button onClick={() => setMode("credits")} className={`rounded-full px-4 py-1.5 text-sm cursor-pointer transition-colors ${mode === "credits" ? "bg-foreground text-background" : "border border-foreground/15 text-muted-foreground hover:text-foreground"}`}>
          Nigeria (credits)
        </button>
        <button onClick={() => setMode("subscription")} className={`rounded-full px-4 py-1.5 text-sm cursor-pointer transition-colors ${mode === "subscription" ? "bg-foreground text-background" : "border border-foreground/15 text-muted-foreground hover:text-foreground"}`}>
          International (subscription)
        </button>
      </div>

      {mode === "credits" ? (
        <>
          <div className="rounded-lg border border-foreground/10 p-5 flex items-center justify-between mb-6">
            <div>
              <p className="text-sm text-muted-foreground">Credits</p>
              <p className="font-display text-3xl">{credits}</p>
            </div>
            <div className="text-right text-xs text-muted-foreground max-w-[260px]">
              1 credit to tailor a CV + cover letter, 1 to submit, 24 for an interview prep session. Pay once; top up when you run out.
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {ngnPacks.map((p) => (
              <div key={p.id} className={`relative rounded-xl border p-5 ${p.popular ? "border-foreground" : "border-foreground/10"}`}>
                {p.popular && <span className="absolute -top-2 right-4 rounded-full bg-foreground text-background px-2 py-0.5 text-[10px] font-medium">Popular</span>}
                <div className="font-display text-3xl">{p.credits}</div>
                <div className="text-sm text-muted-foreground">credits · {p.label}</div>
                <div className="text-xs text-muted-foreground mb-3">≈ {Math.floor(p.credits / 2)} applications</div>
                <div className="text-lg font-medium mb-3">₦{(p.amount / 100).toLocaleString()}</div>
                <button
                  onClick={() => go("/api/billing/checkout", { packId: p.id }, p.id)}
                  disabled={!paymentsEnabled || busy !== null}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-foreground text-background h-9 text-sm cursor-pointer hover:bg-foreground/90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {busy === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {busy === p.id ? "Starting…" : "Buy"}
                </button>
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          {entitlement?.planId && (
            <div className="rounded-lg border border-foreground/10 p-5 mb-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm">
                  Current plan: <span className="font-medium capitalize">{entitlement.planId}</span>
                </p>
                <p className="text-sm text-muted-foreground">{entitlement.used} / {entitlement.allowance} used</p>
              </div>
              <div className="h-2 rounded-full bg-foreground/10 overflow-hidden">
                <div className="h-full bg-foreground" style={{ width: `${Math.min(100, (entitlement.used / Math.max(1, entitlement.allowance)) * 100)}%` }} />
              </div>
            </div>
          )}
          <p className="text-xs text-muted-foreground mb-4">Every tier is the full product. Tiers differ only by applications per 30-day cycle.</p>
          <div className="grid gap-3 sm:grid-cols-3">
            {plans.map((p) => (
              <div key={p.id} className={`relative rounded-xl border p-5 ${p.popular ? "border-foreground" : "border-foreground/10"}`}>
                {p.popular && <span className="absolute -top-2 right-4 rounded-full bg-foreground text-background px-2 py-0.5 text-[10px] font-medium">Most popular</span>}
                <div className="font-medium">{p.name}</div>
                <div className="font-display text-3xl mt-1">${(p.amount / 100).toLocaleString()}<span className="text-sm text-muted-foreground font-sans"> / mo</span></div>
                <div className="text-sm text-muted-foreground mt-1 mb-3">{p.applications.toLocaleString()} applications / cycle</div>
                <p className="text-xs text-muted-foreground mb-4 min-h-[32px]">{p.blurb}</p>
                <button
                  onClick={() => go("/api/billing/subscribe", { planId: p.id }, p.id)}
                  disabled={!paymentsEnabled || busy !== null}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-foreground text-background h-9 text-sm cursor-pointer hover:bg-foreground/90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {busy === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {busy === p.id ? "Starting…" : entitlement?.planId === p.id ? "Current" : "Subscribe"}
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {error && <p className="text-sm text-rose-600 mt-3">{error}</p>}
      {!paymentsEnabled && <p className="text-xs text-muted-foreground mt-3">Payments are not configured yet. Set PAYSTACK_SECRET_KEY to enable checkout.</p>}

      {/* Transaction history */}
      <div className="mt-8">
        <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase mb-3">Recent transactions</p>
        {transactions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No transactions yet.</p>
        ) : (
          <div className="rounded-lg border border-foreground/10 overflow-hidden">
            {transactions.map((t, i) => (
              <div key={t.id} className={`flex items-center gap-3 px-4 py-3 text-sm ${i > 0 ? "border-t border-foreground/5" : ""}`}>
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">{TX_LABEL[t.reason] ?? t.reason}</div>
                  <div className="text-xs text-muted-foreground">{new Date(t.at).toLocaleString()}</div>
                </div>
                <div className={`font-medium tabular-nums ${t.delta >= 0 ? "text-emerald-600" : "text-foreground"}`}>
                  {t.delta >= 0 ? "+" : ""}{t.delta}
                </div>
                <div className="w-16 text-right text-muted-foreground tabular-nums">{t.balanceAfter}</div>
              </div>
            ))}
          </div>
        )}
        {txTotalPages > 1 && (
          <div className="flex items-center justify-between mt-3">
            <button
              onClick={() => router.push(`/dashboard/settings?tab=billing&txPage=${txPage - 1}`)}
              disabled={txPage <= 1}
              className="rounded-lg border border-foreground/15 px-3 h-8 text-sm cursor-pointer hover:border-foreground/40 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span className="text-xs text-muted-foreground">Page {txPage} of {txTotalPages}</span>
            <button
              onClick={() => router.push(`/dashboard/settings?tab=billing&txPage=${txPage + 1}`)}
              disabled={txPage >= txTotalPages}
              className="rounded-lg border border-foreground/15 px-3 h-8 text-sm cursor-pointer hover:border-foreground/40 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function AccountPanel({ email }: { email: string }) {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  return (
    <div className="rounded-xl border border-foreground/10 bg-background p-6">
      <PanelHeader icon={User} title="Account" desc="Your account details" />
      <div className="rounded-lg border border-foreground/10 p-5 mb-4">
        <p className="text-sm text-muted-foreground">Signed in as</p>
        <p className="text-sm font-medium">{email}</p>
      </div>
      <button
        onClick={async () => {
          setSigningOut(true);
          await authClient.signOut();
          router.push("/login");
          router.refresh();
        }}
        className="inline-flex items-center gap-2 rounded-lg border border-foreground/15 px-4 py-2 text-sm hover:border-foreground/40 cursor-pointer"
      >
        <LogOut className="h-4 w-4" />
        {signingOut ? "Signing out…" : "Sign out"}
      </button>
    </div>
  );
}
