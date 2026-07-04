"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Check } from "lucide-react";

// The "mark reviewed" toggle on an admin feedback row.
export function FeedbackHandledToggle({ id, handled }: { id: string; handled: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const toggle = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/feedback/${id}/handled`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handled: !handled }),
      });
      if (res.ok) router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      onClick={toggle}
      disabled={busy}
      className={`inline-flex items-center gap-1.5 rounded-lg px-3 h-8 text-xs cursor-pointer disabled:opacity-50 ${
        handled
          ? "border border-foreground/15 text-muted-foreground hover:text-foreground"
          : "bg-foreground text-background hover:bg-foreground/90"
      }`}
    >
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : handled ? <Check className="h-3.5 w-3.5" /> : null}
      {handled ? "Reviewed" : "Mark reviewed"}
    </button>
  );
}
