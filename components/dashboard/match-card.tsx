"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { CompanyAvatar } from "@/components/dashboard/company-avatar";
import { ApplyButton } from "@/components/dashboard/apply-button";
import { ManualApplyButton } from "@/components/dashboard/manual-apply-button";

export type MatchCardData = {
  id: string;
  title: string;
  location: string;
  remotePolicy: string | null;
  postedAgo: string;
  company: string;
  logoUrl: string | null;
  score: number;
  reason: string;
  locationTag: string; // short eligibility/location label, e.g. "Remote", "US only"
  appState: string | null;
  appVia: string | null; // "cloud" | "extension" | "manual"
  description: string;
  manualApply: boolean; // aggregator/bot-walled: apply in the user's own browser
};

function matchStatus(state: string | null, via: string | null): { label: string; cls: string } | null {
  switch (state) {
    case "drafted": return { label: "Drafting…", cls: "bg-amber-100 text-amber-700" };
    case "awaiting_review": return { label: "Review", cls: "bg-sky-100 text-sky-700" };
    case "queued": return { label: "Queued", cls: "bg-sky-100 text-sky-700" };
    case "sending": return { label: "Sending…", cls: "bg-amber-100 text-amber-700" };
    case "submitted": return via === "manual"
      ? { label: "Applied in browser", cls: "bg-emerald-100 text-emerald-700" }
      : { label: "Applied", cls: "bg-emerald-100 text-emerald-700" };
    case "needs_user": return { label: "Needs you", cls: "bg-rose-100 text-rose-700" };
    case "failed": return { label: "Failed", cls: "bg-rose-100 text-rose-700" };
    default: return null;
  }
}

function MatchRing({ value }: { value: number }) {
  const r = 20;
  const c = 2 * Math.PI * r;
  const dash = (Math.min(Math.max(value, 0), 100) / 100) * c;
  return (
    <div className="relative w-12 h-12 shrink-0">
      <svg viewBox="0 0 48 48" className="w-12 h-12 -rotate-90">
        <circle cx="24" cy="24" r={r} fill="none" strokeWidth="3" stroke="currentColor" className="text-foreground/10" />
        <circle cx="24" cy="24" r={r} fill="none" strokeWidth="3" strokeLinecap="round" stroke="currentColor" className="text-foreground" strokeDasharray={`${dash} ${c}`} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xs font-medium leading-none">{value}%</span>
        <span className="font-mono text-[7px] tracking-widest text-muted-foreground uppercase mt-0.5">match</span>
      </div>
    </div>
  );
}

export function MatchCard({ card: m }: { card: MatchCardData }) {
  const [open, setOpen] = useState(false);
  const status = matchStatus(m.appState, m.appVia);
  const locationLine = m.location || (m.remotePolicy === "remote" ? "Remote" : "");
  // Colour the eligibility tag red-ish when it signals a restriction the user likely
  // can't meet (US only / citizens only), otherwise neutral.
  const tagRestrictive = /only|citizen|clearance|no sponsor/i.test(m.locationTag);
  const tagCls = tagRestrictive ? "bg-rose-50 text-rose-700 border-rose-200" : "bg-foreground/[0.04] text-muted-foreground border-foreground/10";

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    // Lock background scroll while the drawer is open.
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      <div
        onClick={() => setOpen(true)}
        className="rounded-xl border border-foreground/10 bg-background p-5 flex flex-col cursor-pointer hover:border-foreground/30 transition-colors"
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="text-xs text-muted-foreground">{locationLine}</div>
            <div className="text-xs text-muted-foreground">{m.postedAgo}</div>
          </div>
          <MatchRing value={m.score} />
        </div>
        {m.locationTag && (
          <span className={`self-start rounded-full border px-2.5 py-0.5 text-xs mb-3 ${tagCls}`}>{m.locationTag}</span>
        )}
        <h3 className="font-display text-xl tracking-tight mb-3 leading-snug">{m.title}</h3>
        <p className="text-sm text-muted-foreground mb-5 line-clamp-3">{m.reason}</p>
        <div className="flex items-center justify-between gap-2 mt-auto pt-2">
          <span className="flex items-center gap-2 min-w-0">
            <CompanyAvatar name={m.company} logoUrl={m.logoUrl} size={28} />
            <span className="text-sm font-medium truncate">{m.company}</span>
          </span>
          <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
            {status ? (
              <>
                <span className={`rounded-lg px-3 py-1.5 text-sm font-medium ${status.cls}`}>{status.label}</span>
                {m.manualApply && m.appState === "submitted" && <ManualApplyButton jobId={m.id} applied />}
              </>
            ) : (
              <>
                <button className="rounded-lg border border-foreground/15 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:border-foreground/40 cursor-pointer">
                  Pass
                </button>
                {m.manualApply ? <ManualApplyButton jobId={m.id} /> : <ApplyButton jobId={m.id} />}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Right drawer with the full summary + original job description */}
      {open && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-foreground/30 backdrop-blur-[1px]" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-0 h-full w-full max-w-xl bg-background shadow-2xl border-l border-foreground/10 flex flex-col animate-in slide-in-from-right duration-200">
            <div className="flex items-start justify-between gap-4 p-6 border-b border-foreground/10">
              <div className="min-w-0">
                <h2 className="font-display text-2xl tracking-tight leading-snug">{m.title}</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {m.company}{locationLine ? ` · ${locationLine}` : ""}
                </p>
                {m.locationTag && (
                  <span className={`inline-block mt-2 rounded-full border px-2.5 py-0.5 text-xs ${tagCls}`}>{m.locationTag}</span>
                )}
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <MatchRing value={m.score} />
                <button onClick={() => setOpen(false)} className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-foreground/[0.06] cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {m.reason && (
                <section className="mb-6">
                  <p className="font-mono text-[11px] tracking-widest text-muted-foreground uppercase mb-2">Why it matches</p>
                  <p className="text-sm leading-relaxed">{m.reason}</p>
                </section>
              )}
              <section>
                <p className="font-mono text-[11px] tracking-widest text-muted-foreground uppercase mb-2">Job description</p>
                {m.description ? (
                  <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/90">{m.description}</p>
                ) : (
                  <p className="text-sm text-muted-foreground">No description available for this role.</p>
                )}
              </section>
            </div>

            {/* Manual jobs always keep an action (apply, or reopen after applying).
                Cloud jobs only when not yet in a state. */}
            {(m.manualApply || !status) && (
              <div className="p-4 border-t border-foreground/10 flex items-center justify-end gap-2">
                {m.manualApply ? (
                  <div className="w-full">
                    <ManualApplyButton jobId={m.id} full applied={m.appState === "submitted"} />
                    {m.appState !== "submitted" && (
                      <p className="text-xs text-muted-foreground mt-2 text-center">
                        This site blocks automated applying. Opens in your browser with your tailored CV ready. Uses 1 credit.
                      </p>
                    )}
                    {m.appState === "submitted" && (
                      <p className="text-xs text-muted-foreground mt-2 text-center">
                        Already applied. Reopen the page to continue or check it. No credit is charged.
                      </p>
                    )}
                  </div>
                ) : (
                  <ApplyButton jobId={m.id} />
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
