"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Loader2 } from "lucide-react";

export function DiscoverButton({ label = "Find jobs" }: { label?: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const run = async () => {
    setLoading(true);
    try {
      await fetch("/api/discovery/run", { method: "POST" });
    } catch {
      /* ignore */
    }
    // Crawl + scoring run in the worker; refresh once they've had time.
    setTimeout(() => {
      router.refresh();
      setLoading(false);
    }, 35000);
  };

  return (
    <button
      onClick={run}
      disabled={loading}
      className="inline-flex items-center gap-2 rounded-full bg-foreground text-background px-4 py-1.5 text-sm cursor-pointer hover:bg-foreground/90 disabled:opacity-70"
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
      {loading ? "Finding jobs…" : label}
    </button>
  );
}
