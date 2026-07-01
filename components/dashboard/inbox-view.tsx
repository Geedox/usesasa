"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search, Loader2, RefreshCw, Mail } from "lucide-react";

type Category = "verification" | "rejection" | "interview" | "assessment" | "reminder" | "offer" | "other";
type Item = {
  id: string;
  fromName: string;
  fromAddr: string;
  subject: string;
  snippet: string;
  date: number;
  category: Category;
};

const TABS: { key: "all" | Category; label: string }[] = [
  { key: "all", label: "All" },
  { key: "verification", label: "Verification" },
  { key: "rejection", label: "Rejection" },
  { key: "interview", label: "Interview" },
  { key: "assessment", label: "Assessment" },
  { key: "reminder", label: "Reminder" },
  { key: "offer", label: "Offer" },
];

const CAT_STYLE: Record<Category, string> = {
  verification: "bg-sky-100 text-sky-700",
  rejection: "bg-rose-100 text-rose-700",
  interview: "bg-emerald-100 text-emerald-700",
  assessment: "bg-amber-100 text-amber-700",
  reminder: "bg-orange-100 text-orange-700",
  offer: "bg-violet-100 text-violet-700",
  other: "bg-foreground/[0.06] text-muted-foreground",
};

function timeAgo(ms: number): string {
  if (!ms) return "";
  const d = Math.floor((Date.now() - ms) / 86400000);
  if (d <= 0) {
    const h = Math.floor((Date.now() - ms) / 3600000);
    if (h <= 0) return "just now";
    return `${h}h ago`;
  }
  if (d === 1) return "1d ago";
  if (d < 30) return `${d}d ago`;
  return new Date(ms).toLocaleDateString();
}

export function InboxView({ connected, email }: { connected: boolean; email: string }) {
  const [messages, setMessages] = useState<Item[]>([]);
  const [loading, setLoading] = useState(connected);
  const [tab, setTab] = useState<"all" | Category>("all");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Item | null>(null);
  const [body, setBody] = useState<string | null>(null);
  const [bodyLoading, setBodyLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/inbox");
      const data = await res.json();
      setMessages(data.messages ?? []);
    } catch {
      setMessages([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (connected) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected]);

  const openMessage = async (m: Item) => {
    setSelected(m);
    setBody(null);
    setBodyLoading(true);
    try {
      const res = await fetch(`/api/inbox/message/${m.id}`);
      const data = await res.json();
      setBody(res.ok ? data.body : "Could not load this message.");
    } catch {
      setBody("Could not load this message.");
    } finally {
      setBodyLoading(false);
    }
  };

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return messages.filter((m) => {
      if (tab !== "all" && m.category !== tab) return false;
      if (needle && !`${m.subject} ${m.fromName} ${m.fromAddr} ${m.snippet}`.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [messages, tab, q]);

  return (
    <main className="max-w-[1400px] mx-auto px-6 lg:px-10 py-8 pb-12">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`rounded-full px-4 py-1.5 text-sm cursor-pointer transition-colors ${
                active ? "bg-foreground text-background" : "border border-foreground/15 text-muted-foreground hover:text-foreground hover:border-foreground/40"
              }`}
            >
              {t.label}
            </button>
          );
        })}
        <button
          onClick={load}
          disabled={loading}
          className="ml-auto inline-flex items-center gap-2 rounded-lg border border-foreground/15 px-4 h-9 text-sm cursor-pointer hover:border-foreground/40 disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Refresh
        </button>
        <div className="flex items-center gap-2 rounded-lg border border-foreground/10 bg-background px-3 h-9 w-full sm:w-64">
          <Search className="w-4 h-4 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search messages…" className="flex-1 bg-transparent outline-none text-sm" />
        </div>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground mb-4">
        <span>{connected ? email : "Gmail not connected"}</span>
        <span>We auto fill verification codes for you.</span>
      </div>

      {!connected ? (
        <div className="rounded-xl border border-foreground/10 bg-background p-10 text-center">
          <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-foreground/[0.06]">
            <Mail className="h-6 w-6" />
          </span>
          <h3 className="font-display text-xl mb-1">Connect Gmail to see your inbox</h3>
          <p className="text-sm text-muted-foreground mb-5">We surface verification, interview, assessment, reminder, offer and rejection emails from your job applications.</p>
          <Link href="/dashboard/settings?tab=email" className="inline-flex rounded-lg bg-foreground text-background px-5 h-10 items-center text-sm hover:bg-foreground/90">
            Connect Gmail
          </Link>
        </div>
      ) : (
        <div className="grid md:grid-cols-[minmax(0,420px)_1fr] gap-4 min-h-[600px]">
          {/* List */}
          <div className="rounded-xl border border-foreground/10 bg-background overflow-hidden">
            {loading ? (
              <div className="p-10 text-center text-sm text-muted-foreground inline-flex items-center justify-center gap-2 w-full">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading messages…
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-10 text-center">
                <p className="font-medium mb-1">No messages</p>
                <p className="text-sm text-muted-foreground">Job emails from your inbox will appear here</p>
              </div>
            ) : (
              <ul className="divide-y divide-foreground/5">
                {filtered.map((m) => {
                  const active = selected?.id === m.id;
                  return (
                    <li key={m.id}>
                      <button
                        onClick={() => openMessage(m)}
                        className={`w-full text-left px-4 py-3 cursor-pointer transition-colors ${active ? "bg-foreground/[0.04]" : "hover:bg-foreground/[0.02]"}`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium truncate flex-1">{m.fromName}</span>
                          <span className="text-xs text-muted-foreground shrink-0">{timeAgo(m.date)}</span>
                        </div>
                        <div className="text-sm truncate mb-1">{m.subject || "(no subject)"}</div>
                        <div className="flex items-center gap-2">
                          <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${CAT_STYLE[m.category]}`}>{m.category}</span>
                          <span className="text-xs text-muted-foreground truncate">{m.snippet}</span>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Reading pane */}
          <div className="rounded-xl border border-foreground/10 bg-background p-6">
            {!selected ? (
              <div className="h-full min-h-[400px] flex items-center justify-center text-sm text-muted-foreground">Select a message to read</div>
            ) : (
              <div>
                <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-medium mb-3 ${CAT_STYLE[selected.category]}`}>{selected.category}</span>
                <h2 className="font-display text-xl tracking-tight mb-1">{selected.subject || "(no subject)"}</h2>
                <p className="text-sm text-muted-foreground mb-4">
                  {selected.fromName} {selected.fromAddr && selected.fromAddr !== selected.fromName ? `· ${selected.fromAddr}` : ""} · {timeAgo(selected.date)}
                </p>
                {bodyLoading ? (
                  <div className="inline-flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
                ) : (
                  <div className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">{body}</div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
