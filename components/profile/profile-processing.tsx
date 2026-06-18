"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

// Shown while the CV is still being parsed. Polls status and refreshes the
// server page once parsing is done (then the editor renders).
export function ProfileProcessing() {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const res = await fetch("/api/onboarding/status");
        if (res.ok) {
          const { parsed } = await res.json();
          if (parsed) router.refresh();
        }
      } catch {
        /* ignore */
      }
    }, 4000);
    return () => clearInterval(id);
  }, [router]);

  return (
    <main className="max-w-3xl mx-auto px-6 lg:px-10 py-24 flex flex-col items-center text-center">
      <Loader2 className="w-8 h-8 animate-spin mb-6" />
      <h1 className="font-display text-2xl tracking-tight mb-2">We're reading your CV</h1>
      <p className="text-muted-foreground">
        This usually takes under a minute. Your profile will appear here for review as soon as it's ready.
      </p>
    </main>
  );
}
