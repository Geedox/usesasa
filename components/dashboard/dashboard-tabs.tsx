"use client";

import { useState } from "react";

// Tabs for the dashboard so Top matches and All applications don't stack into one
// very long scroll. Both panels stay mounted (toggled with hidden) so switching is
// instant and no in-panel data is lost. The active tab is mirrored into the URL
// (?view=) via replaceState so a refresh or a router.refresh() re-render keeps you on
// the same tab instead of snapping back to matches.
export function DashboardTabs({
  initialTab = "matches",
  matchCount,
  appCount,
  matches,
  applications,
}: {
  initialTab?: "matches" | "apps";
  matchCount: number;
  appCount: number;
  matches: React.ReactNode;
  applications: React.ReactNode;
}) {
  const [tab, setTab] = useState<"matches" | "apps">(initialTab);

  const select = (id: "matches" | "apps") => {
    setTab(id);
    // Keep the URL in sync without a server round-trip, so a refresh restores the tab.
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (id === "apps") url.searchParams.set("view", "apps");
      else url.searchParams.delete("view");
      window.history.replaceState(null, "", url.toString());
    }
  };

  const Tab = ({ id, label }: { id: "matches" | "apps"; label: string }) => (
    <button
      onClick={() => select(id)}
      className={`relative -mb-px px-1 pb-3 text-sm font-medium cursor-pointer transition-colors ${
        tab === id ? "text-foreground" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {label}
      {tab === id && <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-foreground" />}
    </button>
  );

  return (
    <div className="mt-8">
      <div className="flex items-center gap-6 border-b border-foreground/10 mb-6">
        <Tab id="matches" label={`Top job matches${matchCount ? ` (${matchCount})` : ""}`} />
        <Tab id="apps" label={`All applications${appCount ? ` (${appCount})` : ""}`} />
      </div>
      <div className={tab === "matches" ? "" : "hidden"}>{matches}</div>
      <div className={tab === "apps" ? "" : "hidden"}>{applications}</div>
    </div>
  );
}
