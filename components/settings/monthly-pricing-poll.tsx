"use client";

import { useEffect, useState } from "react";
import { X, Check, Loader2, CalendarClock } from "lucide-react";

// A poll in Plans & Billing: "are you okay with month to month billing?". A Yes is
// recorded as feedback (with the signed-in user) so the founders can gauge appetite
// before building it. Logged-in only.
export function MonthlyPricingPoll() {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/feedback/pricing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: note.trim() }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(d.error || "Could not send. Try again.");
        return;
      }
      setDone(true);
    } catch {
      setError("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="mt-6 rounded-lg border border-foreground/10 p-5 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium">Prefer to pay monthly?</p>
          <p className="text-sm text-muted-foreground">We are testing month to month billing for constant applying.</p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 rounded-full border border-foreground/20 px-5 py-2 text-sm font-medium hover:border-foreground/50 hover:bg-foreground/[0.03] transition-colors cursor-pointer shrink-0"
        >
          <CalendarClock className="w-4 h-4" />
          I&apos;m okay with monthly pricing
        </button>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="relative w-full max-w-md rounded-2xl border border-foreground/10 bg-background p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="absolute top-4 right-4 rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-foreground/[0.06] cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {done ? (
              <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                  <Check className="h-6 w-6" />
                </span>
                <p className="font-display text-xl tracking-tight">Thank you</p>
                <p className="text-sm text-muted-foreground">We noted your interest. We will reach out if we roll it out.</p>
              </div>
            ) : (
              <>
                <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-foreground/[0.06]">
                  <CalendarClock className="h-5 w-5" />
                </div>
                <h3 className="font-display text-2xl tracking-tight mb-2">Monthly billing?</h3>
                <p className="text-sm text-muted-foreground leading-relaxed mb-5">
                  We are experimenting with a month to month plan so you can keep applying consistently without topping
                  up. We would love your take. Are you okay with monthly billing?
                </p>

                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  placeholder="Anything you want us to know (optional)"
                  className="w-full rounded-lg border border-foreground/15 bg-background px-3 py-2 text-sm outline-none focus:border-foreground/40 resize-none mb-3"
                />
                {error && <p className="text-sm text-rose-600 mb-2">{error}</p>}
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    disabled={busy}
                    className="rounded-lg border border-foreground/15 px-4 h-10 text-sm hover:border-foreground/40 cursor-pointer"
                  >
                    Not for me
                  </button>
                  <button
                    type="button"
                    onClick={submit}
                    disabled={busy}
                    className="inline-flex items-center gap-2 rounded-lg bg-foreground text-background px-5 h-10 text-sm cursor-pointer hover:bg-foreground/90 disabled:opacity-60"
                  >
                    {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                    {busy ? "Sending…" : "Yes, I'm okay with it"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
