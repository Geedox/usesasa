"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Search } from "lucide-react";

export type AppRow = {
  id: string;
  state: string;
  company: string;
  title: string;
  cvReady: boolean;
  coverReady: boolean;
  embellished: boolean;
  appliedAt: string | null; // ISO
};

const STATE_LABEL: Record<string, string> = {
  drafted: "Tailoring",
  awaiting_review: "Review",
  needs_user: "Needs you",
  queued: "Queued",
  sending: "Sending",
  submitted: "Submitted",
  failed: "Failed",
  dismissed: "Skipped",
};

// Which states each tab includes.
const TABS: { label: string; states: string[] | null }[] = [
  { label: "All", states: null },
  { label: "Submitted", states: ["submitted"] },
  { label: "In flight", states: ["queued", "sending"] },
  { label: "Needs you", states: ["needs_user", "awaiting_review"] },
  { label: "Failed", states: ["failed"] },
  { label: "Skipped", states: ["dismissed"] },
];

function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return "today";
  if (days === 1) return "1 day ago";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? "1 month ago" : `${months} months ago`;
}

export function ApplicationsTable({ rows }: { rows: AppRow[] }) {
  const [tab, setTab] = useState("All");
  const [query, setQuery] = useState("");
  const router = useRouter();

  // Auto-refresh while anything is in flight so the Live badge + statuses update
  // without the user reloading.
  useEffect(() => {
    if (!rows.some((r) => r.state === "queued" || r.state === "sending")) return;
    const id = setInterval(() => router.refresh(), 5000);
    return () => clearInterval(id);
  }, [rows, router]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const t of TABS) c[t.label] = t.states === null ? rows.length : rows.filter((r) => t.states!.includes(r.state)).length;
    return c;
  }, [rows]);

  const filtered = useMemo(() => {
    const active = TABS.find((t) => t.label === tab)!;
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (active.states && !active.states.includes(r.state)) return false;
      if (q && !`${r.company} ${r.title}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, tab, query]);

  return (
    <div className="rounded-xl border border-foreground/10 bg-background">
      <div className="flex flex-wrap items-center gap-2 p-4 border-b border-foreground/10">
        {TABS.map((t) => {
          const active = t.label === tab;
          return (
            <button
              key={t.label}
              onClick={() => setTab(t.label)}
              className={`rounded-full px-3 py-1 text-sm cursor-pointer ${
                active ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label} <span className={active ? "text-background/60" : "text-muted-foreground"}>{counts[t.label]}</span>
            </button>
          );
        })}
        <div className="ml-auto flex items-center gap-2 rounded-lg border border-foreground/10 px-3 h-8">
          <Search className="w-3.5 h-3.5 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search company..."
            className="bg-transparent outline-none text-sm w-40"
          />
        </div>
      </div>

      <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] px-6 py-3 border-b border-foreground/10 font-mono text-[11px] tracking-widest text-muted-foreground uppercase">
        <span>Company</span><span>CV</span><span>Cover letter</span><span>Status</span><span>Applied</span>
      </div>

      {filtered.length === 0 ? (
        <div className="py-16 text-center text-sm text-muted-foreground">
          {rows.length === 0 ? "No applications yet. Approve a match above and it will show up here." : "Nothing in this tab."}
        </div>
      ) : (
        filtered.map((a) => (
          <Link
            key={a.id}
            href={`/dashboard/applications/${a.id}`}
            className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] items-center px-6 py-4 border-b border-foreground/5 last:border-b-0 text-sm hover:bg-foreground/[0.02]"
          >
            <span className="min-w-0 truncate flex items-center gap-2">
              <span className="truncate"><span className="font-medium">{a.company}</span> · <span className="text-muted-foreground">{a.title}</span></span>
              {a.embellished && (
                <span className="shrink-0 rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 text-[10px] font-medium">Embellished</span>
              )}
            </span>
            <span className="text-muted-foreground">{a.cvReady ? "Ready" : "—"}</span>
            <span className="text-muted-foreground">{a.coverReady ? "Ready" : "Off"}</span>
            <span>
              {a.state === "sending" ? (
                <span className="inline-flex items-center gap-1.5 rounded-md bg-green-100 text-green-800 px-2 py-0.5 text-xs font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-600 animate-pulse" /> Live · watch
                </span>
              ) : (
                <span className="rounded-md bg-foreground/[0.05] px-2 py-0.5 text-xs">{STATE_LABEL[a.state] ?? a.state}</span>
              )}
            </span>
            <span className="text-muted-foreground">{timeAgo(a.appliedAt)}</span>
          </Link>
        ))
      )}
    </div>
  );
}
