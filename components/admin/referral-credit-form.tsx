"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

// Admin tool: backfill a missed referral. Enter the referrer's code, the referred
// user's email, and an amount. Credits the referrer and records the referral.
export function ReferralCreditForm() {
  const [code, setCode] = useState("");
  const [email, setEmail] = useState("");
  const [amount, setAmount] = useState("5");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [owner, setOwner] = useState<string | null>(null);

  const lookup = async () => {
    setOwner(null);
    setError(null);
    if (!code.trim()) return;
    try {
      const res = await fetch(`/api/admin/referral-credit?code=${encodeURIComponent(code.trim())}`);
      const d = await res.json();
      if (d.found) setOwner(`Code owned by ${d.name || d.email} (${d.email}) · ${d.balance} credits`);
      else setOwner(`No user owns "${code.trim().toUpperCase()}"`);
    } catch {
      /* ignore */
    }
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/admin/referral-credit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim(), email: email.trim(), amount: parseInt(amount, 10) }),
      });
      const d = await res.json();
      if (!res.ok) return setError(d.error || "Could not credit.");
      setResult(d.message || "Done.");
      setEmail("");
    } catch {
      setError("Network error.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-foreground/10 bg-background p-6 max-w-xl">
      <h2 className="font-medium mb-1">Credit a referrer</h2>
      <p className="text-sm text-muted-foreground mb-5">
        Enter the referrer&apos;s code and the referred user&apos;s email. The referrer (the code owner) is credited,
        and the referral is recorded so milestone rewards track from here.
      </p>

      <div className="flex flex-col gap-4">
        <div>
          <label className="font-mono text-[11px] tracking-widest text-muted-foreground uppercase block mb-1.5">Referral code</label>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onBlur={lookup}
            placeholder="e.g. ENVQD2"
            className="w-full rounded-lg border border-foreground/15 bg-background h-10 px-3 text-sm outline-none focus:border-foreground/40 uppercase"
          />
          {owner && <p className="text-xs text-muted-foreground mt-1.5">{owner}</p>}
        </div>
        <div>
          <label className="font-mono text-[11px] tracking-widest text-muted-foreground uppercase block mb-1.5">Referred user email · optional</label>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="friend@email.com"
            className="w-full rounded-lg border border-foreground/15 bg-background h-10 px-3 text-sm outline-none focus:border-foreground/40"
          />
        </div>
        <div>
          <label className="font-mono text-[11px] tracking-widest text-muted-foreground uppercase block mb-1.5">Credits</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-32 rounded-lg border border-foreground/15 bg-background h-10 px-3 text-sm outline-none focus:border-foreground/40"
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={submit}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-lg bg-foreground text-background px-5 h-10 text-sm cursor-pointer hover:bg-foreground/90 disabled:opacity-50"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Credit the referrer
          </button>
        </div>

        {result && <p className="text-sm text-emerald-600">{result}</p>}
        {error && <p className="text-sm text-rose-600">{error}</p>}
      </div>
    </div>
  );
}
