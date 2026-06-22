"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

type MentorOpt = { id: string; name: string };

// Admin assigns (or reassigns) an approved mentor to a booking.
export function AssignMentor({ bookingId, mentors, currentMentorId }: { bookingId: string; mentors: MentorOpt[]; currentMentorId: string | null }) {
  const router = useRouter();
  const [mentorId, setMentorId] = useState(currentMentorId ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const assign = async () => {
    if (!mentorId) return setError("Pick a mentor.");
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/bookings/${bookingId}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mentorId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not assign.");
        return;
      }
      router.refresh();
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <select
        value={mentorId}
        onChange={(e) => setMentorId(e.target.value)}
        className="rounded-lg border border-foreground/15 bg-background h-9 px-2 text-sm outline-none focus:border-foreground/40 cursor-pointer"
      >
        <option value="">Select mentor…</option>
        {mentors.map((m) => (
          <option key={m.id} value={m.id}>{m.name}</option>
        ))}
      </select>
      <button onClick={assign} disabled={loading} className="inline-flex items-center gap-2 rounded-lg bg-foreground text-background px-4 h-9 text-sm cursor-pointer hover:bg-foreground/90 disabled:opacity-50">
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {currentMentorId ? "Reassign" : "Assign"}
      </button>
      {error && <span className="text-sm text-rose-600">{error}</span>}
    </div>
  );
}
