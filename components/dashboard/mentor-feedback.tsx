"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

// Inline form a mentor uses to score (0-100) and write feedback for one assigned call.
export function MentorFeedback({
  bookingId,
  initialScore,
  initialFeedback,
}: {
  bookingId: string;
  initialScore: number | null;
  initialFeedback: string | null;
}) {
  const router = useRouter();
  const [score, setScore] = useState(initialScore != null ? String(initialScore) : "");
  const [feedback, setFeedback] = useState(initialFeedback ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const submit = async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/interview/${bookingId}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ score: Number(score), feedback }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not save feedback.");
        return;
      }
      setSaved(true);
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-3 border-t border-foreground/10 pt-3">
      <div className="flex items-center gap-3 mb-2">
        <label className="flex items-center gap-2 text-sm">
          <span className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">Score</span>
          <input
            type="number"
            min={0}
            max={100}
            value={score}
            onChange={(e) => setScore(e.target.value)}
            className="w-20 rounded-lg border border-foreground/15 bg-background h-9 px-2 text-sm outline-none focus:border-foreground/40"
          />
          <span className="text-muted-foreground">/ 100</span>
        </label>
        {saved && <span className="text-xs text-emerald-600">Saved</span>}
      </div>
      <textarea
        value={feedback}
        onChange={(e) => setFeedback(e.target.value)}
        rows={4}
        placeholder="Honest feedback: strengths, what to improve, and concrete next steps."
        className="w-full rounded-lg border border-foreground/15 bg-background px-3 py-2 text-sm outline-none focus:border-foreground/40 resize-y mb-2"
      />
      {error && <p className="text-sm text-rose-600 mb-2">{error}</p>}
      <button
        onClick={submit}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-lg bg-foreground text-background px-4 h-9 text-sm cursor-pointer hover:bg-foreground/90 disabled:opacity-50"
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {initialScore != null ? "Update feedback" : "Submit feedback"}
      </button>
    </div>
  );
}
