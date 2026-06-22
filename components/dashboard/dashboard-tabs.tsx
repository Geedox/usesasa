"use client";

import { useState } from "react";

// Tabs for the dashboard so Top matches and All applications don't stack into one
// very long scroll. Both panels stay mounted (toggled with hidden) so switching is
// instant and any in-panel state is preserved.
export function DashboardTabs({
  matchCount,
  appCount,
  matches,
  applications,
}: {
  matchCount: number;
  appCount: number;
  matches: React.ReactNode;
  applications: React.ReactNode;
}) {
  const [tab, setTab] = useState<"matches" | "apps">("matches");

  const Tab = ({ id, label }: { id: "matches" | "apps"; label: string }) => (
    <button
      onClick={() => setTab(id)}
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
