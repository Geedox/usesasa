"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, ExternalLink } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { notifyCreditsChanged } from "@/components/dashboard/credits-badge";

// Apply in the user's own browser: confirms the 1-credit charge, then opens a blank
// tab synchronously (so the popup blocker allows it), charges, and points the tab at
// the job link. Used for aggregator / bot-walled jobs the cloud browser can't reach.
export function ManualApplyButton({ jobId, full = false, applied = false }: { jobId: string; full?: boolean; applied?: boolean }) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [localApplied, setLocalApplied] = useState(false);
  const [noCredit, setNoCredit] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const isApplied = applied || localApplied;

  // Runs from a user gesture, so window.open is allowed. For an already-applied job the
  // endpoint returns the URL WITHOUT charging again, so "Open job" is free to reopen.
  const proceed = async () => {
    setBusy(true);
    setErr(null);
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
        setLocalApplied(true);
        setConfirmOpen(false);
        notifyCreditsChanged();
        router.refresh();
      } else {
        win?.close();
        setConfirmOpen(false);
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

  // Already applied: reopen the job link, no charge.
  if (isApplied) {
    return (
      <div className={full ? "w-full" : ""}>
        <button
          onClick={proceed}
          disabled={busy}
          title="Reopen the job page. No credit is charged."
          className={`inline-flex items-center justify-center gap-1.5 rounded-lg border border-foreground/15 px-4 py-1.5 text-sm cursor-pointer hover:border-foreground/40 disabled:opacity-60 ${full ? "w-full" : ""}`}
        >
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ExternalLink className="w-3.5 h-3.5" />}
          Open job
        </button>
        {err && <p className="text-xs text-rose-600 mt-1">{err}</p>}
      </div>
    );
  }

  return (
    <div className={full ? "w-full" : ""}>
      <button
        onClick={() => setConfirmOpen(true)}
        className={`inline-flex items-center justify-center gap-1.5 rounded-lg bg-foreground text-background px-4 py-1.5 text-sm cursor-pointer hover:bg-foreground/90 disabled:opacity-80 ${full ? "w-full" : ""}`}
      >
        <ExternalLink className="w-3.5 h-3.5" />
        Apply in browser
      </button>
      {err && <p className="text-xs text-rose-600 mt-1">{err}</p>}

      <Dialog open={confirmOpen} onOpenChange={(v) => !busy && setConfirmOpen(v)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl tracking-tight">Apply in your own browser</DialogTitle>
            <DialogDescription className="text-sm leading-relaxed">
              This site blocks automated applying, so we will open the job in a new tab for you to apply directly.
              <span className="font-medium text-foreground"> Sasa will charge 1 credit</span> for this and mark the
              role as applied. Your tailored CV and details are in your dashboard, ready to use.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={busy} className="rounded-lg cursor-pointer">
              Cancel
            </Button>
            <Button
              onClick={proceed}
              disabled={busy}
              className="rounded-lg bg-foreground text-background hover:bg-foreground/90 cursor-pointer inline-flex items-center gap-2"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {busy ? "Opening…" : "Apply now (1 credit)"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
