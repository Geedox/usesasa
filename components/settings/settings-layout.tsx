"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SlidersHorizontal, Cable, CreditCard, User, Check, LogOut } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { ConnectExtension } from "@/components/settings/connect-extension";
import { ConnectTelegram } from "@/components/settings/connect-telegram";

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
  { key: "billing", label: "Plans & Billing", icon: CreditCard },
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
  extensionConnected,
  telegramConnected,
  email,
  credits,
}: {
  apply: ApplySettings;
  extensionConnected: boolean;
  telegramConnected: boolean;
  email: string;
  credits: number;
}) {
  const [section, setSection] = useState<NavKey>("apply");

  return (
    <main className="max-w-[1100px] mx-auto px-6 lg:px-10 py-8">
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
          {section === "apply" && <ApplyPanel initial={initialApply} />}
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
          {section === "billing" && <BillingPanel credits={credits} />}
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

function ApplyPanel({ initial }: { initial: ApplySettings }) {
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

function BillingPanel({ credits }: { credits: number }) {
  return (
    <div className="rounded-xl border border-foreground/10 bg-background p-6">
      <PanelHeader icon={CreditCard} title="Plans & Billing" desc="Your application credits" />
      <div className="rounded-lg border border-foreground/10 p-5 flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Applications left</p>
          <p className="font-display text-3xl">{credits}</p>
        </div>
        <button disabled className="rounded-lg border border-foreground/15 px-4 py-2 text-sm text-muted-foreground cursor-not-allowed">
          Buy a pack (soon)
        </button>
      </div>
      <p className="text-xs text-muted-foreground mt-3">
        One credit is used only when an application is actually submitted. Credit packs are coming soon.
      </p>
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
