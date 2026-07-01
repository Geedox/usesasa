"use client";

import { useState } from "react";

export type CompDetails = {
  salaryExpectation: string;
  salaryPeriod: string;
  noticePeriod: string;
  yearsExperience: string;
};

const NOTICE = ["Immediately", "1 week", "2 weeks", "1 month", "2 months", "3 months"];
const PERIODS = ["year", "month", "hour"];

// Editable compensation + availability. These feed the agent's answers for the
// salary, notice-period, and experience questions that show up on most forms.
export function ProfileDetails({ initial }: { initial: CompDetails }) {
  const [comp, setComp] = useState<CompDetails>(initial);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async (patch: Partial<CompDetails>) => {
    const next = { ...comp, ...patch };
    setComp(next);
    setSaving(true);
    await fetch("/api/preferences/profile-details", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ patch }),
    }).catch(() => {});
    setSaving(false);
    setSavedAt(Date.now());
  };

  return (
    <div className="rounded-xl border border-foreground/10 overflow-hidden">
      <div className="flex items-center justify-between bg-foreground/[0.03] px-5 py-2">
        <span className="font-mono text-[11px] tracking-widest text-muted-foreground uppercase">Compensation and availability</span>
        {savedAt && !saving && <span className="text-xs text-green-600">Saved</span>}
      </div>
      <div className="px-5 py-5 flex flex-col gap-5">
        <div className="grid sm:grid-cols-2 gap-5">
          <label className="flex flex-col gap-2">
            <span className="font-mono text-[11px] tracking-widest text-muted-foreground uppercase">Expected salary</span>
            <input
              className="border-b border-foreground/15 bg-transparent py-1.5 text-sm outline-none focus:border-foreground"
              value={comp.salaryExpectation}
              placeholder="e.g. 90,000 or Negotiable"
              onChange={(e) => setComp({ ...comp, salaryExpectation: e.target.value })}
              onBlur={(e) => save({ salaryExpectation: e.target.value })}
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className="font-mono text-[11px] tracking-widest text-muted-foreground uppercase">Per</span>
            <div className="inline-flex rounded-lg bg-foreground/5 p-1 w-fit">
              {PERIODS.map((p) => (
                <button key={p} type="button" onClick={() => save({ salaryPeriod: p })}
                  className={`px-3 py-1.5 text-sm rounded-md transition-colors cursor-pointer capitalize ${comp.salaryPeriod === p ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}>
                  {p}
                </button>
              ))}
            </div>
          </label>
        </div>
        <div className="flex flex-col gap-2">
          <span className="font-mono text-[11px] tracking-widest text-muted-foreground uppercase">Notice period</span>
          <div className="flex flex-wrap gap-2">
            {NOTICE.map((n) => (
              <button key={n} type="button" onClick={() => save({ noticePeriod: n })}
                className={`rounded-lg border px-3 py-2 text-sm transition-colors cursor-pointer ${comp.noticePeriod === n ? "border-foreground bg-foreground text-background" : "border-foreground/15 hover:border-foreground/40"}`}>
                {n}
              </button>
            ))}
          </div>
        </div>
        <label className="flex flex-col gap-2">
          <span className="font-mono text-[11px] tracking-widest text-muted-foreground uppercase">Years of experience</span>
          <input
            className="border-b border-foreground/15 bg-transparent py-1.5 text-sm outline-none focus:border-foreground max-w-[120px]"
            value={comp.yearsExperience}
            placeholder="e.g. 5"
            onChange={(e) => setComp({ ...comp, yearsExperience: e.target.value })}
            onBlur={(e) => save({ yearsExperience: e.target.value })}
          />
        </label>
      </div>
    </div>
  );
}
