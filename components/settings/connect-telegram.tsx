"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function ConnectTelegram({ connected }: { connected: boolean }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const connect = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/telegram/link", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not start the connection.");
      window.open(data.url, "_blank");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="rounded-xl border border-foreground/10 bg-background p-6 max-w-2xl mt-6">
      <h2 className="font-display text-xl tracking-tight mb-1">Run the agent from Telegram</h2>
      <p className="text-sm text-muted-foreground mb-5">
        When the agent finds a new match, it asks you on Telegram whether to apply. Tap yes and it tailors
        your CV and cover letter, then asks you to approve before anything is submitted. You can run the
        whole loop without opening the dashboard.
      </p>

      {connected ? (
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-foreground/[0.06] px-3 py-1 text-sm">Connected</span>
          <Button onClick={connect} disabled={loading} variant="outline" className="rounded-lg cursor-pointer">
            {loading ? "Opening…" : "Reconnect"}
          </Button>
        </div>
      ) : (
        <Button
          onClick={connect}
          disabled={loading}
          className="rounded-lg bg-foreground text-background hover:bg-foreground/90 cursor-pointer"
        >
          {loading ? "Opening…" : "Connect Telegram"}
        </Button>
      )}
      {error && <p className="text-sm text-red-600 mt-3">{error}</p>}

      <ol className="text-sm text-muted-foreground mt-6 space-y-1 list-decimal pl-5">
        <li>Tap Connect Telegram. It opens a chat with the Sasa bot.</li>
        <li>Press Start in Telegram to link this account.</li>
        <li>For each new match you get a message asking if you want to apply.</li>
        <li>Tap yes, the agent tailors it, then asks you to approve before submitting.</li>
      </ol>
    </section>
  );
}
