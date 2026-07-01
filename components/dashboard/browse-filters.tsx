"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2 } from "lucide-react";

type Opt = { key: string; label: string };

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <label className="flex flex-col gap-1 min-w-[130px]">
      <span className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="rounded-lg border border-foreground/15 bg-background h-9 px-2 text-sm outline-none focus:border-foreground/40 cursor-pointer">
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}

export function BrowseFilters({
  statuses,
  levels,
  workplaces,
  locChips,
  initial,
}: {
  statuses: Opt[];
  levels: Opt[];
  workplaces: Opt[];
  locChips: string[];
  initial: { q: string; loc: string; status: string; lvl: string; work: string; sponsor: boolean };
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [clearing, setClearing] = useState(false);
  const [q, setQ] = useState(initial.q);
  const [loc, setLoc] = useState(initial.loc);
  const [status, setStatus] = useState(initial.status);
  const [lvl, setLvl] = useState(initial.lvl);
  const [work, setWork] = useState(initial.work);
  const [sponsor, setSponsor] = useState(initial.sponsor);

  const apply = () => {
    const sp = new URLSearchParams();
    if (status && status !== "all") sp.set("status", status);
    if (q.trim()) sp.set("q", q.trim());
    if (loc.trim()) sp.set("loc", loc.trim());
    if (lvl) sp.set("lvl", lvl);
    if (work) sp.set("work", work);
    if (sponsor) sp.set("sponsor", "1");
    setClearing(false);
    start(() => router.push(`/dashboard/browse${sp.toString() ? `?${sp}` : ""}`));
  };
  const clear = () => {
    setClearing(true);
    start(() => router.push("/dashboard/browse"));
  };

  const applying = pending && !clearing;

  return (
    <form onSubmit={(e) => { e.preventDefault(); apply(); }} className="flex flex-wrap items-end gap-3 rounded-xl border border-foreground/10 bg-background p-4">
      <label className="flex flex-col gap-1 flex-1 min-w-[180px]">
        <span className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">Search</span>
        <div className="flex items-center gap-2 rounded-lg border border-foreground/15 h-9 px-3">
          <Search className="w-4 h-4 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Title or company" className="flex-1 bg-transparent outline-none text-sm" />
        </div>
      </label>
      <label className="flex flex-col gap-1 min-w-[150px]">
        <span className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">Country / city</span>
        <input value={loc} onChange={(e) => setLoc(e.target.value)} list="loc-suggestions" placeholder="Anywhere" className="rounded-lg border border-foreground/15 bg-background h-9 px-3 text-sm outline-none focus:border-foreground/40" />
        <datalist id="loc-suggestions">{locChips.map((c) => <option key={c} value={c} />)}</datalist>
      </label>
      <Select label="Status" value={status} onChange={setStatus} options={statuses.map((s) => ({ value: s.key, label: s.label }))} />
      <Select label="Level" value={lvl} onChange={setLvl} options={[{ value: "", label: "Any" }, ...levels.map((s) => ({ value: s.key, label: s.label }))]} />
      <Select label="Workplace" value={work} onChange={setWork} options={[{ value: "", label: "Any" }, ...workplaces.map((w) => ({ value: w.key, label: w.label }))]} />
      <label className="flex items-center gap-2 text-sm h-9 px-1 cursor-pointer">
        <input type="checkbox" checked={sponsor} onChange={(e) => setSponsor(e.target.checked)} className="cursor-pointer" /> Sponsors visa
      </label>
      <button type="submit" disabled={pending} className="rounded-lg bg-foreground text-background px-5 h-9 text-sm cursor-pointer hover:bg-foreground/90 disabled:opacity-70 inline-flex items-center gap-2">
        {applying ? <><Loader2 className="w-4 h-4 animate-spin" /> Applying…</> : "Apply"}
      </button>
      <button type="button" onClick={clear} disabled={pending} className="text-sm text-muted-foreground hover:text-foreground h-9 inline-flex items-center gap-1 cursor-pointer disabled:opacity-70">
        {pending && clearing ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Clearing…</> : "Clear"}
      </button>
    </form>
  );
}
