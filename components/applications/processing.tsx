"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

// Shown while tailoring is still running (application state = drafted).
export function ApplicationProcessing({ title }: { title: string }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => router.refresh(), 5000);
    return () => clearInterval(id);
  }, [router]);

  return (
    <main className="max-w-2xl mx-auto px-6 lg:px-10 py-24 flex flex-col items-center text-center">
      <Loader2 className="w-8 h-8 animate-spin mb-6" />
      <h1 className="font-display text-2xl tracking-tight mb-2">Tailoring your application</h1>
      <p className="text-muted-foreground">
        Rewriting your résumé and drafting a cover letter for {title}. This usually takes under a minute.
      </p>
    </main>
  );
}
