"use client";

import { useState } from "react";

export type ContactLinks = {
  linkedin: string;
  github: string;
  portfolio: string;
  twitter: string;
  facebook: string;
  instagram: string;
};

const FIELDS: { k: keyof ContactLinks; label: string; ph: string }[] = [
  { k: "linkedin", label: "LinkedIn", ph: "https://linkedin.com/in/you" },
  { k: "github", label: "GitHub", ph: "https://github.com/you" },
  { k: "portfolio", label: "Portfolio / website", ph: "https://yourname.com" },
  { k: "twitter", label: "X / Twitter", ph: "https://x.com/you" },
  { k: "instagram", label: "Instagram", ph: "https://instagram.com/you" },
  { k: "facebook", label: "Facebook", ph: "https://facebook.com/you" },
];

// Edit the contact/social links the agent fills into applications when a form asks.
export function ContactLinksEditor({ initial }: { initial: ContactLinks }) {
  const [s, setS] = useState<ContactLinks>(initial);
  const [saved, setSaved] = useState<string | null>(null);

  const persist = async (k: keyof ContactLinks, v: string) => {
    if (v === initial[k]) return;
    await fetch("/api/preferences/contact-links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ patch: { [k]: v } }),
    }).catch(() => {});
    setSaved(k);
    setTimeout(() => setSaved(null), 1200);
  };

  return (
    <div className="rounded-lg border border-foreground/10 overflow-hidden">
      <div className="bg-foreground/[0.03] px-5 py-2 font-mono text-[11px] tracking-widest text-muted-foreground uppercase">
        Links and socials
      </div>
      <div className="px-5 py-4">
        <p className="text-sm text-muted-foreground mb-4">
          The agent fills these into applications only when a form asks for them. All optional.
        </p>
        <div className="grid sm:grid-cols-2 gap-4">
          {FIELDS.map((f) => (
            <div key={f.k} className="flex flex-col gap-1.5">
              <span className="font-mono text-[11px] tracking-widest text-muted-foreground uppercase">
                {f.label}
                {saved === f.k && <span className="ml-2 text-emerald-600 tracking-normal normal-case">saved</span>}
              </span>
              <input
                value={s[f.k]}
                placeholder={f.ph}
                onChange={(e) => setS((p) => ({ ...p, [f.k]: e.target.value }))}
                onBlur={(e) => persist(f.k, e.target.value.trim())}
                className="rounded-lg border border-foreground/15 bg-background h-10 px-3 text-sm outline-none focus:border-foreground/40"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
