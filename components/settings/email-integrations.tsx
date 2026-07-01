"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, Check, Loader2 } from "lucide-react";
import { authClient } from "@/lib/auth-client";

const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";

export type EmailNotifications = {
  jobRecommendations: boolean;
  productUpdates: boolean;
  pausedUntil: string | null;
  timezone: string;
};

const TIMEZONES = [
  "Africa/Lagos",
  "Africa/Nairobi",
  "Africa/Johannesburg",
  "Europe/London",
  "Europe/Berlin",
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "Asia/Dubai",
  "Asia/Kolkata",
];

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

async function patchNotifications(patch: Partial<EmailNotifications>) {
  await fetch("/api/preferences/email-notifications", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ patch }),
  });
}

export function EmailIntegrations({
  hasScope,
  enabled,
  email,
  notifications,
}: {
  hasScope: boolean;
  enabled: boolean;
  email: string | null;
  notifications: EmailNotifications;
}) {
  const router = useRouter();
  const [n, setN] = useState<EmailNotifications>(notifications);
  const [busy, setBusy] = useState(false);

  // Gmail connect is gated off until Google OAuth verification is approved. Flip it on
  // (no code change) with NEXT_PUBLIC_GMAIL_ENABLED=1 once verified.
  const gmailEnabled = process.env.NEXT_PUBLIC_GMAIL_ENABLED === "1";

  const connected = hasScope && enabled;

  const update = (patch: Partial<EmailNotifications>) => {
    setN((prev) => ({ ...prev, ...patch }));
    void patchNotifications(patch);
  };

  // Reuse the Better Auth Google account and request the extra gmail.readonly scope.
  const connect = async () => {
    setBusy(true);
    await authClient.linkSocial({
      provider: "google",
      scopes: [GMAIL_SCOPE],
      callbackURL: "/dashboard/settings?tab=email",
    });
  };

  const setEnabled = async (value: boolean) => {
    setBusy(true);
    await fetch("/api/integrations/gmail/disconnect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: value }),
    });
    router.refresh();
    setBusy(false);
  };

  const pausedUntil = n.pausedUntil ? new Date(n.pausedUntil) : null;
  const isPaused = !!pausedUntil && pausedUntil.getTime() > Date.now();

  return (
    <div className="flex flex-col gap-6">
      {/* Permissions explainer */}
      <div className="rounded-xl border border-foreground/10 bg-background p-6">
        <h2 className="font-display text-xl tracking-tight mb-4">Connect your email</h2>
        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <p className="text-sm font-medium mb-2">We capture</p>
            <ul className="space-y-1.5 text-sm text-muted-foreground">
              <li>One time codes from job applications</li>
              <li>Verification links from job platforms</li>
            </ul>
          </div>
          <div>
            <p className="text-sm font-medium mb-2">We never</p>
            <ul className="space-y-1.5 text-sm text-muted-foreground">
              <li>Store your emails (read only access)</li>
              <li>Read personal content (job emails only)</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Gmail provider */}
      <div className="rounded-xl border border-foreground/10 bg-background p-6">
        <div className="text-center mb-6">
          <h2 className="font-display text-xl tracking-tight">Gmail</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Connect Gmail so Sasa can capture verification codes and links from your job applications automatically.
          </p>
        </div>

        {!gmailEnabled ? (
          <div className="mx-auto max-w-md">
            <div className="rounded-xl border border-foreground/10 bg-foreground/[0.02] p-6 text-center">
              <span className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-foreground/[0.06]">
                <Mail className="h-6 w-6" />
              </span>
              <p className="text-sm font-medium mb-1">Coming soon</p>
              <p className="text-sm text-muted-foreground">
                Gmail connect is being finalized. Soon you will be able to link your inbox so Sasa can grab
                verification codes from your applications automatically.
              </p>
            </div>
          </div>
        ) : connected ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 shrink-0">
              <Check className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-emerald-900">Gmail connected</p>
              {email && <p className="text-xs text-emerald-800 truncate">{email}</p>}
            </div>
            <button
              onClick={() => setEnabled(false)}
              disabled={busy}
              className="rounded-lg border border-foreground/15 bg-background px-4 h-9 text-sm cursor-pointer hover:border-foreground/40 disabled:opacity-50 inline-flex items-center gap-2"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {busy ? "Working…" : "Disconnect"}
            </button>
          </div>
        ) : hasScope ? (
          // Scope already granted but the user turned reading off — no Google round trip needed.
          <div className="rounded-lg border border-foreground/10 p-4 flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Gmail access is paused</p>
              {email && <p className="text-xs text-muted-foreground truncate">{email}</p>}
            </div>
            <button
              onClick={() => setEnabled(true)}
              disabled={busy}
              className="rounded-lg bg-foreground text-background px-4 h-9 text-sm cursor-pointer hover:bg-foreground/90 disabled:opacity-50 inline-flex items-center gap-2"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {busy ? "Working…" : "Resume"}
            </button>
          </div>
        ) : (
          <div className="mx-auto max-w-md">
            <div className="rounded-xl border border-foreground/10 p-6 text-center">
              <span className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-foreground/[0.06]">
                <Mail className="h-6 w-6" />
              </span>
              <p className="text-sm text-muted-foreground mb-4">Uses your Sasa Google account</p>
              <button
                onClick={connect}
                disabled={busy}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-foreground text-background px-5 h-11 text-sm cursor-pointer hover:bg-foreground/90 disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />} Connect Gmail
              </button>
            </div>
            <p className="text-center text-xs text-muted-foreground mt-3">
              Read only permission. We only access job related emails. No personal data stored.
            </p>
          </div>
        )}
      </div>

      {/* Email notifications */}
      <div className="rounded-xl border border-foreground/10 bg-background p-6">
        <div className="flex items-start gap-3 mb-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-foreground/[0.06] shrink-0">
            <Mail className="h-4 w-4" />
          </div>
          <div>
            <h2 className="font-display text-xl tracking-tight leading-none mb-1">Email notifications</h2>
            <p className="text-sm text-muted-foreground">Daily job recommendations at 9 AM in your timezone</p>
          </div>
        </div>

        <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase mb-2">Email types</p>
        <div className="rounded-lg border border-foreground/10 overflow-hidden mb-5">
          <div className={`px-5 py-4 flex items-center justify-between gap-4 ${isPaused ? "opacity-60" : ""}`}>
            <div>
              <p className="text-sm font-medium">Job recommendations</p>
              <p className="text-sm text-muted-foreground">Daily personalized job matches based on your profile</p>
            </div>
            <Switch on={n.jobRecommendations} onToggle={(v) => update({ jobRecommendations: v })} />
          </div>
          <div className="px-5 py-4 flex items-center justify-between gap-4 border-t border-foreground/5">
            <div>
              <p className="text-sm font-medium">Product updates</p>
              <p className="text-sm text-muted-foreground">New features, tips, and platform announcements</p>
            </div>
            <Switch on={n.productUpdates} onToggle={(v) => update({ productUpdates: v })} />
          </div>
        </div>

        {/* Pause */}
        <div className="flex items-center justify-between mb-5">
          {isPaused ? (
            <>
              <p className="text-sm text-muted-foreground">
                Paused until {pausedUntil!.toLocaleDateString()}
              </p>
              <button onClick={() => update({ pausedUntil: null })} className="text-sm text-foreground hover:underline cursor-pointer">
                Resume now
              </button>
            </>
          ) : (
            <button
              onClick={() => update({ pausedUntil: new Date(Date.now() + 30 * 86400000).toISOString() })}
              className="text-sm text-muted-foreground hover:text-foreground cursor-pointer"
            >
              Pause for 30 days
            </button>
          )}
        </div>

        {/* Timezone */}
        <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase mb-2">Timezone</p>
        <select
          value={n.timezone}
          onChange={(e) => update({ timezone: e.target.value })}
          className="w-full rounded-lg border border-foreground/15 bg-background h-10 px-3 text-sm outline-none focus:border-foreground/40 cursor-pointer"
        >
          {(TIMEZONES.includes(n.timezone) ? TIMEZONES : [n.timezone, ...TIMEZONES]).map((tz) => (
            <option key={tz} value={tz}>{tz}</option>
          ))}
        </select>

        <p className="text-xs text-muted-foreground mt-4 rounded-lg border border-foreground/10 p-3">
          About daily emails: we send the top 3 to 5 job matches from new listings in the last 24 hours, personalized to your profile. Every email includes an unsubscribe link.
        </p>
      </div>
    </div>
  );
}
