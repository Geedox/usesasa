"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

export function ApplyButton({ jobId }: { jobId: string }) {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");

  const apply = async () => {
    setState("loading");
    try {
      const res = await fetch("/api/applications/tailor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId }),
      });
      setState(res.ok ? "done" : "error");
    } catch {
      setState("error");
    }
  };

  return (
    <button
      onClick={state === "idle" || state === "error" ? apply : undefined}
      disabled={state === "loading" || state === "done"}
      className="inline-flex items-center gap-1.5 rounded-lg bg-foreground text-background px-4 py-1.5 text-sm cursor-pointer hover:bg-foreground/90 disabled:opacity-80"
    >
      {state === "loading" && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
      {state === "loading" ? "Tailoring…" : state === "done" ? "Drafting" : state === "error" ? "Retry" : "Apply"}
    </button>
  );
}
