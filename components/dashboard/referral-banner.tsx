"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Gift, Copy, Check, X } from "lucide-react";

const DISMISS_KEY = "sasa_referral_banner_dismissed";

// Compact, dismissible nudge on the dashboard to share the referral code.
export function ReferralBanner({ code, shareUrl }: { code: string; shareUrl: string }) {
  const [hidden, setHidden] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setHidden(localStorage.getItem(DISMISS_KEY) === "1");
  }, []);
  if (hidden) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard may be blocked */
    }
  };
  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setHidden(true);
  };

  return (
    <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-foreground/10 bg-foreground/[0.03] px-4 py-3">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-foreground text-background shrink-0">
        <Gift className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">Invite friends, earn 5 credits each</p>
        <p className="text-xs text-muted-foreground">
          Your code <span className="font-mono tracking-widest text-foreground">{code}</span> · earn more when they buy a pack
        </p>
      </div>
      <button onClick={copy} className="inline-flex items-center gap-2 rounded-lg bg-foreground text-background px-4 h-9 text-sm cursor-pointer hover:bg-foreground/90">
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        {copied ? "Copied" : "Copy link"}
      </button>
      <Link href="/dashboard/settings?tab=referrals" className="text-sm text-muted-foreground hover:text-foreground">
        Details
      </Link>
      <button onClick={dismiss} aria-label="Dismiss" className="text-muted-foreground hover:text-foreground cursor-pointer">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
