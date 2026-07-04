"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, ExternalLink } from "lucide-react";

// Apply in the user's own browser: opens a blank tab synchronously (so the popup
// blocker allows it), charges 1 credit, then points the tab at the job link. Used for
// aggregator / bot-walled jobs where the cloud browser can't get through.
export function ManualApplyButton({ jobId, full = false }: { jobId: string; full?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [applied, setApplied] = useState(false);
  const [noCredit, setNoCredit] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    setErr(null);
    setNoCredit(false);
    const win = window.open("", "_blank");
    try {
      const res = await fetch("/api/applications/manual-apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok && j.url) {
        if (win) win.location.href = j.url;
        else window.open(j.url, "_blank");
        setApplied(true);
        router.refresh();
      } else {
        win?.close();
        if (res.status === 402) setNoCredit(true);
        else setErr(j.error || "Could not open the job link.");
      }
    } catch {
      win?.close();
      setErr("Network error.");
    } finally {
      setBusy(false);
    }
  };

  if (noCredit) {
    return (
      <Link
        href="/dashboard/settings?tab=billing"
        className={`inline-flex items-center justify-center gap-1.5 rounded-lg bg-foreground text-background px-4 py-1.5 text-sm cursor-pointer hover:bg-foreground/90 ${full ? "w-full" : ""}`}
      >
        Add credits
      </Link>
    );
  }

  return (
    <div className={full ? "w-full" : ""}>
      <button
        onClick={run}
        disabled={busy || applied}
        title="Opens the job in a new tab. Uses 1 credit."
        className={`inline-flex items-center justify-center gap-1.5 rounded-lg bg-foreground text-background px-4 py-1.5 text-sm cursor-pointer hover:bg-foreground/90 disabled:opacity-80 ${full ? "w-full" : ""}`}
      >
        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ExternalLink className="w-3.5 h-3.5" />}
        {applied ? "Applied" : busy ? "Opening…" : "Apply in browser"}
      </button>
      {err && <p className="text-xs text-rose-600 mt-1">{err}</p>}
    </div>
  );
}
