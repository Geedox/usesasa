"use client";

import { useState } from "react";

export function EmbellishmentToggle({ initial }: { initial: boolean }) {
  const [enabled, setEnabled] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const toggle = async () => {
    const next = !enabled;
    setEnabled(next);
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/preferences/embellishment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: next }),
      });
      if (!res.ok) throw new Error("Could not save.");
    } catch (e) {
      setEnabled(!next); // revert on failure
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-xl border border-foreground/10 bg-background p-6 max-w-2xl mt-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-xl tracking-tight mb-1">Honesty</h2>
          <p className="text-sm text-muted-foreground">
            Let the agent add job relevant skills you have not listed (for example WebRTC if a role asks for it).
            Off by default: the agent uses only your true facts and a fact checker blocks anything it cannot verify.
            Turn this on only if you understand that claims you cannot back up in an interview can cost you the offer.
          </p>
        </div>
        <button
          role="switch"
          aria-checked={enabled}
          onClick={toggle}
          disabled={saving}
          className={`relative h-6 w-11 shrink-0 rounded-full transition-colors cursor-pointer ${
            enabled ? "bg-foreground" : "bg-foreground/20"
          }`}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-background transition-transform ${
              enabled ? "translate-x-5" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>
      <p className="text-xs text-muted-foreground mt-3">
        {enabled ? "On. The agent may add skills you did not list, and the fact checker is bypassed." : "Off. True facts only."}
      </p>
      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
    </section>
  );
}
