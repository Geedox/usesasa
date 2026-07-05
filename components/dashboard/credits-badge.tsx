"use client";

import { useCallback, useEffect, useState } from "react";

// Dispatch this after any action that debits/credits the balance so the badge updates
// instantly, instead of waiting for the next poll or a manual refresh.
export function notifyCreditsChanged() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event("sasa:credits"));
}

// A live credits number: seeded from the server, then kept fresh by polling, on tab
// focus, and on the "sasa:credits" event, so debits reflect without a page refresh.
export function CreditsBadge({ initial, className }: { initial: number; className?: string }) {
  const [balance, setBalance] = useState(initial);

  const refetch = useCallback(async () => {
    try {
      const res = await fetch("/api/credits/balance", { cache: "no-store" });
      if (!res.ok) return;
      const d = await res.json();
      if (typeof d.balance === "number") setBalance(d.balance);
    } catch {
      /* keep the last value */
    }
  }, []);

  useEffect(() => {
    const onEvt = () => void refetch();
    window.addEventListener("sasa:credits", onEvt);
    window.addEventListener("focus", onEvt);
    const iv = setInterval(refetch, 15000);
    return () => {
      window.removeEventListener("sasa:credits", onEvt);
      window.removeEventListener("focus", onEvt);
      clearInterval(iv);
    };
  }, [refetch]);

  return <span className={className}>{balance}</span>;
}
