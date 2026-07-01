"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { DiscoverButton } from "@/components/dashboard/discover-button";

const MESSAGES = [
  "Scanning Greenhouse, Lever, and Ashby boards",
  "Pulling fresh roles from watched companies",
  "Reading job descriptions",
  "Scoring each role against your profile",
  "Picking your strongest matches",
];

export function ScanningMatches() {
  const router = useRouter();
  // Assume a scan is running until the first poll says otherwise (a new user
  // lands here right after we enqueue the scan).
  const [scanning, setScanning] = useState(true);
  const [msgIndex, setMsgIndex] = useState(0);
  const refreshed = useRef(false);

  useEffect(() => {
    let alive = true;

    const poll = async () => {
      try {
        const res = await fetch("/api/discovery/status", { cache: "no-store" });
        if (!res.ok) return;
        const { matchCount, pending } = (await res.json()) as { matchCount: number; pending: boolean };
        if (!alive) return;
        if (matchCount > 0) {
          // Results landed: load them once.
          if (!refreshed.current) {
            refreshed.current = true;
            router.refresh();
          }
          return;
        }
        setScanning(pending);
      } catch {
        /* keep polling */
      }
    };

    poll();
    const pollTimer = setInterval(poll, 3000);
    const msgTimer = setInterval(() => setMsgIndex((i) => (i + 1) % MESSAGES.length), 2500);
    return () => {
      alive = false;
      clearInterval(pollTimer);
      clearInterval(msgTimer);
    };
  }, [router]);

  if (!scanning) {
    return (
      <div className="rounded-xl border border-dashed border-foreground/15 bg-background py-20 text-center mb-12">
        <p className="font-display text-xl mb-2">No matches yet</p>
        <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
          We did not find roles that fit your profile this time. Try again, or widen your preferences in settings.
        </p>
        <div className="flex justify-center">
          <DiscoverButton />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-foreground/10 bg-background py-16 px-6 text-center mb-12">
      <p className="font-display text-xl mb-2">Finding jobs for you</p>
      <p className="text-sm text-muted-foreground mb-8 h-5 transition-all">{MESSAGES[msgIndex]}</p>
      <div className="mx-auto max-w-md h-2 rounded-full bg-foreground/10 overflow-hidden">
        <div className="h-full w-1/3 rounded-full bg-foreground animate-scan-slide" />
      </div>
      <p className="text-xs text-muted-foreground mt-6">
        This usually takes about a minute. Matches appear here automatically, no need to refresh.
      </p>
    </div>
  );
}
