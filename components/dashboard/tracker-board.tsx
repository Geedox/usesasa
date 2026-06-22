"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, ExternalLink, FileText, Eye, BarChart3 } from "lucide-react";
import { CompanyAvatar } from "@/components/dashboard/company-avatar";

export type Column = "applied" | "ghosted" | "interviewing" | "rejected";
export type TrackerCard = {
  id: string;
  company: string;
  logoUrl?: string | null;
  title: string;
  jobUrl: string | null;
  submittedAt: string | null;
  column: Column;
};

const COLUMNS: { key: Column; label: string; accent: string }[] = [
  { key: "applied", label: "Applied", accent: "bg-foreground/30" },
  { key: "ghosted", label: "Ghosted", accent: "bg-amber-300" },
  { key: "interviewing", label: "Interviewing", accent: "bg-sky-300" },
  { key: "rejected", label: "Rejected", accent: "bg-rose-300" },
];

function shortDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function Card({ c }: { c: TrackerCard }) {
  return (
    <div className="rounded-xl border border-foreground/10 bg-background p-3 hover:border-foreground/20 transition-colors">
      <div className="flex items-center gap-2.5 mb-2.5">
        <CompanyAvatar name={c.company} logoUrl={c.logoUrl} size={32} />
        <span className="font-medium truncate">{c.company}</span>
      </div>
      <div className="flex items-center justify-between text-muted-foreground">
        <div className="flex items-center gap-2.5">
          {c.jobUrl && (
            <a href={c.jobUrl} target="_blank" rel="noreferrer" title="Open job posting" className="hover:text-foreground">
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
          <Link href={`/dashboard/applications/${c.id}`} title="View application" className="hover:text-foreground">
            <FileText className="w-3.5 h-3.5" />
          </Link>
          <Link href={`/dashboard/applications/${c.id}`} title="Review" className="hover:text-foreground">
            <Eye className="w-3.5 h-3.5" />
          </Link>
        </div>
        <span className="text-xs">{shortDate(c.submittedAt)}</span>
      </div>
    </div>
  );
}

export function TrackerBoard({ cards }: { cards: TrackerCard[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? cards.filter((c) => `${c.company} ${c.title}`.toLowerCase().includes(q)) : cards;
  }, [cards, query]);

  const byColumn = useMemo(() => {
    const m: Record<Column, TrackerCard[]> = { applied: [], ghosted: [], interviewing: [], rejected: [] };
    for (const c of filtered) m[c.column].push(c);
    return m;
  }, [filtered]);

  return (
    <main className="max-w-[1400px] mx-auto px-6 lg:px-10 py-8">
      <div className="flex items-center gap-4 mb-8 flex-wrap">
        <h1 className="font-display text-3xl tracking-tight">Tracker</h1>
        <div className="flex items-center gap-2 rounded-lg border border-foreground/10 bg-background px-3 h-10 w-full sm:w-80">
          <Search className="w-4 h-4 text-muted-foreground" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search companies" className="flex-1 bg-transparent outline-none text-sm" />
        </div>
        <div className="ml-auto">
          <Link href="/dashboard/browse" className="rounded-lg bg-foreground text-background px-4 h-10 inline-flex items-center text-sm hover:bg-foreground/90">
            Add application
          </Link>
        </div>
      </div>

      {/* Status-transitions chart placeholder */}
      <div className="rounded-xl border border-foreground/10 bg-background flex flex-col items-center justify-center py-12 mb-10">
        <div className="w-10 h-10 rounded-lg bg-foreground/[0.04] flex items-center justify-center mb-3">
          <BarChart3 className="w-5 h-5 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium">Not enough data</p>
        <p className="text-sm text-muted-foreground">Status transitions will appear as applications move through stages</p>
      </div>

      {/* Kanban columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {COLUMNS.map((col) => (
          <div key={col.key}>
            <div className="flex items-center justify-between mb-1">
              <span className="font-mono text-[11px] tracking-widest text-muted-foreground uppercase">{col.label}</span>
              <span className="text-sm text-muted-foreground">{byColumn[col.key].length}</span>
            </div>
            <div className={`h-0.5 rounded-full ${col.accent} mb-4`} />
            <div className="flex flex-col gap-3">
              {byColumn[col.key].length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">No applications</p>
              ) : (
                byColumn[col.key].map((c) => <Card key={c.id} c={c} />)
              )}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
