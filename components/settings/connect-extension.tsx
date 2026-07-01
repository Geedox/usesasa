"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function ConnectExtension() {
  const [token, setToken] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  const generate = async () => {
    setLoading(true);
    setError("");
    setCopied(false);
    try {
      const res = await fetch("/api/extension/token", { method: "POST" });
      if (!res.ok) throw new Error("Could not generate a token.");
      const { token, expiresAt } = await res.json();
      setToken(token);
      setExpiresAt(expiresAt ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const copy = async () => {
    await navigator.clipboard.writeText(token);
    setCopied(true);
  };

  return (
    <section className="rounded-xl border border-foreground/10 bg-background p-6 max-w-2xl">
      <h2 className="font-display text-xl tracking-tight mb-1">Connect the Chrome extension</h2>
      <p className="text-sm text-muted-foreground mb-5">
        The extension submits your approved applications from your own browser. Generate a token, then
        paste it into the extension popup. Treat it like a password.
      </p>

      {token ? (
        <div className="rounded-lg border border-foreground/15 p-4">
          <div className="font-mono text-sm break-all mb-3">{token}</div>
          <div className="flex items-center gap-3">
            <Button onClick={copy} className="rounded-lg cursor-pointer">{copied ? "Copied" : "Copy"}</Button>
            <span className="text-xs text-muted-foreground">Shown once. Generate again if you lose it (the old one stops working).</span>
          </div>
          {expiresAt && (
            <p className="text-xs text-muted-foreground mt-3">
              Valid for 30 days, until {new Date(expiresAt).toLocaleDateString()}. Generate a new one before it expires.
            </p>
          )}
        </div>
      ) : (
        <Button onClick={generate} disabled={loading} className="rounded-lg bg-foreground text-background hover:bg-foreground/90 cursor-pointer">
          {loading ? "Generating…" : "Generate connect token"}
        </Button>
      )}
      {error && <p className="text-sm text-red-600 mt-3">{error}</p>}

      <ol className="text-sm text-muted-foreground mt-6 space-y-1 list-decimal pl-5">
        <li>Install the Sasa Chrome extension.</li>
        <li>Open it, set the App URL, and paste this token.</li>
        <li>Approve matches here; the extension submits the queued ones in your browser.</li>
      </ol>
    </section>
  );
}
