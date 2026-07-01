"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

const BASE = "/admin00944452347756348ad";

// Approve (sets the mentor's Cal link / title / expertise) or reject (with a reason)
// a single mentor application.
export function ApplicationReview({ id }: { id: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<"none" | "approve" | "reject">("none");
  const [calLink, setCalLink] = useState("");
  const [title, setTitle] = useState("");
  const [expertise, setExpertise] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async (payload: Record<string, unknown>) => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`${BASE.replace("/admin", "/api/admin")}/mentor-applications/${id}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Action failed.");
        return;
      }
      router.refresh();
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  };

  if (mode === "none") {
    return (
      <div className="flex items-center gap-2">
        <button onClick={() => setMode("approve")} className="rounded-lg bg-foreground text-background px-4 h-9 text-sm cursor-pointer hover:bg-foreground/90">
          Approve
        </button>
        <button onClick={() => setMode("reject")} className="rounded-lg border border-foreground/15 px-4 h-9 text-sm cursor-pointer hover:border-foreground/40">
          Reject
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-foreground/10 p-3">
      {mode === "approve" ? (
        <div className="grid gap-2">
          <input value={calLink} onChange={(e) => setCalLink(e.target.value)} placeholder="Cal event link (e.g. mentor/interview-prep)" className="rounded-lg border border-foreground/15 bg-background h-9 px-3 text-sm outline-none focus:border-foreground/40" />
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title (e.g. Staff Engineer, ex fintech)" className="rounded-lg border border-foreground/15 bg-background h-9 px-3 text-sm outline-none focus:border-foreground/40" />
          <input value={expertise} onChange={(e) => setExpertise(e.target.value)} placeholder="Expertise (comma separated)" className="rounded-lg border border-foreground/15 bg-background h-9 px-3 text-sm outline-none focus:border-foreground/40" />
          {error && <p className="text-sm text-rose-600">{error}</p>}
          <div className="flex items-center gap-2">
            <button onClick={() => send({ decision: "approve", calLink, title, expertise })} disabled={loading} className="inline-flex items-center gap-2 rounded-lg bg-foreground text-background px-4 h-9 text-sm cursor-pointer hover:bg-foreground/90 disabled:opacity-50">
              {loading && <Loader2 className="h-4 w-4 animate-spin" />} Confirm approve
            </button>
            <button onClick={() => setMode("none")} className="text-sm text-muted-foreground hover:text-foreground cursor-pointer">Cancel</button>
          </div>
        </div>
      ) : (
        <div className="grid gap-2">
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="Reason (shown to the applicant so they can re-apply)" className="rounded-lg border border-foreground/15 bg-background px-3 py-2 text-sm outline-none focus:border-foreground/40 resize-y" />
          {error && <p className="text-sm text-rose-600">{error}</p>}
          <div className="flex items-center gap-2">
            <button onClick={() => send({ decision: "reject", reason })} disabled={loading} className="inline-flex items-center gap-2 rounded-lg bg-rose-600 text-white px-4 h-9 text-sm cursor-pointer hover:bg-rose-700 disabled:opacity-50">
              {loading && <Loader2 className="h-4 w-4 animate-spin" />} Confirm reject
            </button>
            <button onClick={() => setMode("none")} className="text-sm text-muted-foreground hover:text-foreground cursor-pointer">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
