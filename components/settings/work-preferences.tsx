"use client";

import { useState } from "react";

export type WorkPrefs = { arrangements: string[]; internshipOnly: boolean };

const ARRANGEMENTS: { v: string; label: string; desc: string }[] = [
  { v: "remote", label: "Remote", desc: "Work from anywhere" },
  { v: "hybrid", label: "Hybrid", desc: "Mix of home and office" },
  { v: "onsite", label: "Onsite", desc: "In the office" },
];

async function patch(body: { workArrangements?: string[]; internshipOnly?: boolean }) {
  await fetch("/api/preferences/work-preferences", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ patch: body }),
  });
}

export function WorkPreferences({ initial }: { initial: WorkPrefs }) {
  const [s, setS] = useState<WorkPrefs>(initial);

  const toggleArrangement = (v: string) => {
    const arrangements = s.arrangements.includes(v) ? s.arrangements.filter((x) => x !== v) : [...s.arrangements, v];
    setS((p) => ({ ...p, arrangements }));
    void patch({ workArrangements: arrangements });
  };
  const setInternshipOnly = (internshipOnly: boolean) => {
    setS((p) => ({ ...p, internshipOnly }));
    void patch({ internshipOnly });
  };

  return (
    <div className="rounded-lg border border-foreground/10 overflow-hidden">
      <div className="bg-foreground/[0.03] px-5 py-2 font-mono text-[11px] tracking-widest text-muted-foreground uppercase">
        What roles to find
      </div>

      <div className="px-5 py-4">
        <p className="text-sm font-medium mb-1">Work arrangement</p>
        <p className="text-sm text-muted-foreground mb-3">Leave all off to include every arrangement.</p>
        <div className="grid sm:grid-cols-3 gap-2">
          {ARRANGEMENTS.map((a) => {
            const active = s.arrangements.includes(a.v);
            return (
              <button
                key={a.v}
                type="button"
                onClick={() => toggleArrangement(a.v)}
                className={`rounded-lg border px-4 py-3 text-left transition-colors cursor-pointer ${
                  active ? "border-foreground bg-foreground text-background" : "border-foreground/15 hover:border-foreground/40"
                }`}
              >
                <span className="block text-sm font-medium">{a.label}</span>
                <span className="block text-xs opacity-70">{a.desc}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="px-5 py-4 border-t border-foreground/5">
        <p className="text-sm font-medium mb-1">Employment type</p>
        <p className="text-sm text-muted-foreground mb-3">Internships only is great if you are after experience.</p>
        <div className="grid sm:grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setInternshipOnly(false)}
            className={`rounded-lg border px-4 py-3 text-left transition-colors cursor-pointer ${
              !s.internshipOnly ? "border-foreground bg-foreground text-background" : "border-foreground/15 hover:border-foreground/40"
            }`}
          >
            <span className="block text-sm font-medium">Open to all roles</span>
            <span className="block text-xs opacity-70">Full time, contract, and internships</span>
          </button>
          <button
            type="button"
            onClick={() => setInternshipOnly(true)}
            className={`rounded-lg border px-4 py-3 text-left transition-colors cursor-pointer ${
              s.internshipOnly ? "border-foreground bg-foreground text-background" : "border-foreground/15 hover:border-foreground/40"
            }`}
          >
            <span className="block text-sm font-medium">Internships only</span>
            <span className="block text-xs opacity-70">Only find and apply to internships</span>
          </button>
        </div>
        {s.internshipOnly && (
          <p className="text-sm text-muted-foreground mt-3 rounded-lg bg-foreground/[0.03] p-3">
            The agent will only surface internships on your dashboard and in Telegram.
          </p>
        )}
      </div>
    </div>
  );
}
