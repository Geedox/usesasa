"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

// Admin controls on a user detail page: adjust credits, and suspend/reinstate.
export function UserActions({
  userId,
  suspended,
}: {
  userId: string;
  suspended: boolean;
}) {
  const router = useRouter();
  const [delta, setDelta] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<null | "credits" | "suspend">(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const adjust = async () => {
    const n = parseInt(delta, 10);
    if (!n) return setError("Enter a non-zero number of credits (use a minus sign to deduct).");
    setError(null);
    setNote(null);
    setBusy("credits");
    try {
      const res = await fetch(`/api/admin/users/${userId}/credits`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ delta: n }),
      });
      const data = await res.json();
      if (!res.ok) return setError(data.error || "Could not adjust credits.");
      setDelta("");
      setNote(`New balance: ${data.balance} credits.`);
      router.refresh();
    } catch {
      setError("Network error.");
    } finally {
      setBusy(null);
    }
  };

  const toggleSuspend = async () => {
    if (suspended ? false : !confirm("Suspend this user? They will be signed out and blocked from all paid actions.")) return;
    setError(null);
    setNote(null);
    setBusy("suspend");
    try {
      const res = await fetch(`/api/admin/users/${userId}/suspend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ suspend: !suspended, reason: reason.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) return setError(data.error || "Could not update.");
      router.refresh();
    } catch {
      setError("Network error.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {/* Adjust credits */}
      <div className="rounded-2xl border border-foreground/10 bg-background p-5">
        <h3 className="font-medium mb-1">Adjust credits</h3>
        <p className="text-sm text-muted-foreground mb-3">Positive to grant, negative to deduct.</p>
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={delta}
            onChange={(e) => setDelta(e.target.value)}
            placeholder="e.g. 10 or -5"
            className="w-32 rounded-lg border border-foreground/15 bg-background h-9 px-3 text-sm outline-none focus:border-foreground/40"
          />
          <button
            onClick={adjust}
            disabled={busy !== null}
            className="inline-flex items-center gap-2 rounded-lg bg-foreground text-background px-4 h-9 text-sm cursor-pointer hover:bg-foreground/90 disabled:opacity-50"
          >
            {busy === "credits" && <Loader2 className="h-4 w-4 animate-spin" />}
            Apply
          </button>
        </div>
      </div>

      {/* Suspend / reinstate */}
      <div className="rounded-2xl border border-foreground/10 bg-background p-5">
        <h3 className="font-medium mb-1">{suspended ? "Reinstate account" : "Suspend account"}</h3>
        <p className="text-sm text-muted-foreground mb-3">
          {suspended ? "Restore access to Sasa." : "Blocks the dashboard, extension, Telegram and submissions."}
        </p>
        {!suspended && (
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason (optional, shown to the user)"
            className="w-full mb-2 rounded-lg border border-foreground/15 bg-background h-9 px-3 text-sm outline-none focus:border-foreground/40"
          />
        )}
        <button
          onClick={toggleSuspend}
          disabled={busy !== null}
          className={`inline-flex items-center gap-2 rounded-lg px-4 h-9 text-sm cursor-pointer disabled:opacity-50 ${
            suspended
              ? "bg-foreground text-background hover:bg-foreground/90"
              : "bg-rose-600 text-white hover:bg-rose-700"
          }`}
        >
          {busy === "suspend" && <Loader2 className="h-4 w-4 animate-spin" />}
          {suspended ? "Reinstate" : "Suspend"}
        </button>
      </div>

      {(error || note) && (
        <p className={`text-sm sm:col-span-2 ${error ? "text-rose-600" : "text-emerald-600"}`}>{error || note}</p>
      )}
    </div>
  );
}
