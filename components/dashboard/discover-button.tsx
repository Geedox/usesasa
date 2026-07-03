"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sparkles, Loader2, Coins } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function DiscoverButton({ label = "Find jobs" }: { label?: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [needCredit, setNeedCredit] = useState<string | null>(null);

  const run = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/discovery/run", { method: "POST" });
      if (res.status === 402) {
        const { error } = await res.json().catch(() => ({}));
        setNeedCredit(error || "Please add credits to find more jobs.");
        setLoading(false);
        return;
      }
      if (!res.ok) {
        setLoading(false);
        return;
      }
    } catch {
      setLoading(false);
      return;
    }
    // Crawl + scoring run in the worker; refresh once they've had time.
    setTimeout(() => {
      router.refresh();
      setLoading(false);
    }, 35000);
  };

  return (
    <>
      <button
        onClick={run}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-full bg-foreground text-background px-4 py-1.5 text-sm cursor-pointer hover:bg-foreground/90 disabled:opacity-70"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
        {loading ? "Finding jobs…" : label}
      </button>

      <Dialog open={needCredit !== null} onOpenChange={(v) => !v && setNeedCredit(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-foreground/[0.06]">
              <Coins className="h-5 w-5" />
            </div>
            <DialogTitle className="font-display text-2xl tracking-tight">You are out of credits</DialogTitle>
            <DialogDescription className="text-sm leading-relaxed">
              {needCredit} A scan finds fresh roles and re-scores your matches, which costs 1 credit. Top up and try
              again.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setNeedCredit(null)} className="rounded-lg cursor-pointer">
              Not now
            </Button>
            <Button asChild className="rounded-lg bg-foreground text-background hover:bg-foreground/90 cursor-pointer">
              <Link href="/dashboard/settings?tab=billing" onClick={() => setNeedCredit(null)}>
                Top up credits
              </Link>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
