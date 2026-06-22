"use client";

import { useState } from "react";
import { Gift, Copy, Check } from "lucide-react";

export type ReferralSummary = { code: string; referredCount: number; creditsEarned: number };

export function ReferralsPanel({ referral, shareUrl }: { referral: ReferralSummary; shareUrl: string }) {
  const [copied, setCopied] = useState<"code" | "link" | null>(null);
  const copy = async (text: string, which: "code" | "link") => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(which);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* clipboard may be blocked */
    }
  };

  return (
    <div className="rounded-xl border border-foreground/10 bg-background p-6">
      <div className="flex items-start gap-3 mb-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-foreground/[0.06] shrink-0">
          <Gift className="h-4 w-4" />
        </div>
        <div>
          <h2 className="font-display text-2xl tracking-tight leading-none mb-1">Referrals</h2>
          <p className="text-sm text-muted-foreground">Invite people and earn free credits</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="rounded-lg border border-foreground/10 p-4">
          <div className="font-display text-3xl">{referral.referredCount}</div>
          <div className="text-sm text-muted-foreground">people referred</div>
        </div>
        <div className="rounded-lg border border-foreground/10 p-4">
          <div className="font-display text-3xl">{referral.creditsEarned}</div>
          <div className="text-sm text-muted-foreground">credits earned</div>
        </div>
      </div>

      {/* Code */}
      <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase mb-2">Your code</p>
      <div className="flex items-center gap-2 mb-4">
        <span className="font-mono text-lg tracking-widest rounded-lg border border-foreground/15 px-4 h-11 inline-flex items-center bg-foreground/[0.03]">{referral.code}</span>
        <button onClick={() => copy(referral.code, "code")} className="inline-flex items-center gap-2 rounded-lg border border-foreground/15 px-4 h-11 text-sm cursor-pointer hover:border-foreground/40">
          {copied === "code" ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
          {copied === "code" ? "Copied" : "Copy"}
        </button>
      </div>

      {/* Share link */}
      <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase mb-2">Share link</p>
      <div className="flex items-center gap-2 mb-6">
        <input readOnly value={shareUrl} className="flex-1 rounded-lg border border-foreground/15 bg-background h-11 px-3 text-sm outline-none" />
        <button onClick={() => copy(shareUrl, "link")} className="inline-flex items-center gap-2 rounded-lg bg-foreground text-background px-4 h-11 text-sm cursor-pointer hover:bg-foreground/90">
          {copied === "link" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copied === "link" ? "Copied" : "Copy"}
        </button>
      </div>

      {/* How it works */}
      <div className="rounded-lg border border-foreground/10 p-5">
        <p className="text-sm font-medium mb-2">How it works</p>
        <ul className="space-y-1.5 text-sm text-muted-foreground">
          <li>Someone signs up with your code and finishes onboarding, you get 5 credits.</li>
          <li>They buy the 15,000 naira pack, you get 5 more.</li>
          <li>They buy the 30,000 naira pack, you get another 5.</li>
        </ul>
        <p className="text-xs text-muted-foreground mt-3">Each reward is paid once per person, not on every top up.</p>
      </div>
    </div>
  );
}
