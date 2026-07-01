"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, X, Trash2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  type Profile,
  emptyExperience,
  emptyEducation,
  emptyLanguage,
} from "@/lib/profile";

function Label({ children }: { children: React.ReactNode }) {
  return <span className="font-mono text-[11px] tracking-widest text-muted-foreground uppercase">{children}</span>;
}

function Section({ title, children, onAdd }: { title: string; children: React.ReactNode; onAdd?: () => void }) {
  return (
    <section className="rounded-xl border border-foreground/10 bg-background p-6">
      <div className="flex items-center justify-between mb-5">
        <h2 className="font-display text-xl tracking-tight">{title}</h2>
        {onAdd && (
          <button onClick={onAdd} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground cursor-pointer">
            <Plus className="w-4 h-4" /> Add
          </button>
        )}
      </div>
      {children}
    </section>
  );
}

function ChipList({ items, onChange, placeholder }: { items: string[]; onChange: (next: string[]) => void; placeholder: string }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const v = draft.trim();
    if (v && !items.includes(v)) onChange([...items, v]);
    setDraft("");
  };
  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-3">
        {items.map((it, i) => (
          <span key={`${it}-${i}`} className="inline-flex items-center gap-1.5 rounded-md bg-foreground/[0.05] px-2.5 py-1 text-sm">
            {it}
            <button onClick={() => onChange(items.filter((_, idx) => idx !== i))} className="text-muted-foreground hover:text-foreground cursor-pointer">
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        {items.length === 0 && <span className="text-sm text-muted-foreground">Nothing yet.</span>}
      </div>
      <Input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            add();
          }
        }}
        onBlur={add}
        placeholder={placeholder}
        className="max-w-sm"
      />
    </div>
  );
}

export function ProfileEditor({ initial }: { initial: Profile }) {
  const [data, setData] = useState<Profile>(initial);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const update = (patch: Partial<Profile>) => {
    setData((d) => ({ ...d, ...patch }));
    setDirty(true);
    setError("");
  };

  // Warn before leaving with unsaved edits.
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || "Could not save. Please try again.");
      }
      setDirty(false);
      setSavedAt(Date.now());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  };

  // experience helpers
  const setExp = (i: number, patch: Partial<Profile["experience"][number]>) =>
    update({ experience: data.experience.map((e, idx) => (idx === i ? { ...e, ...patch } : e)) });
  const setEdu = (i: number, patch: Partial<Profile["education"][number]>) =>
    update({ education: data.education.map((e, idx) => (idx === i ? { ...e, ...patch } : e)) });

  return (
    <main className="max-w-3xl mx-auto px-6 lg:px-10 py-8">
      <Link href="/dashboard/profile" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6">
        <ArrowLeft className="w-4 h-4" /> Back to profile
      </Link>
      <div className="flex items-start justify-between gap-4 mb-2">
        <div>
          <p className="font-mono text-xs tracking-widest text-muted-foreground uppercase mb-2">Your profile</p>
          <h1 className="font-display text-3xl lg:text-4xl tracking-tight">Review your profile</h1>
        </div>
        <div className="flex items-center gap-3 pt-2">
          {savedAt && !dirty && <span className="text-sm text-muted-foreground">Saved</span>}
          <Button onClick={save} disabled={saving || !dirty} className="rounded-lg bg-foreground text-background hover:bg-foreground/90 cursor-pointer">
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </div>
      <p className="text-muted-foreground mb-8">
        We extracted this from your CV. Fix anything that's wrong. We only use what's here, and we never
        add facts you didn't include.
      </p>

      {error && <p className="text-sm text-red-600 mb-6">{error}</p>}

      <div className="flex flex-col gap-6">
        {/* Basics */}
        <Section title="Basics">
          <div className="grid sm:grid-cols-2 gap-5">
            <div className="flex flex-col gap-2">
              <Label>Full name</Label>
              <Input value={data.full_name} onChange={(e) => update({ full_name: e.target.value })} />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Email</Label>
              <Input type="email" value={data.email} onChange={(e) => update({ email: e.target.value })} />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Phone</Label>
              <Input value={data.phone} onChange={(e) => update({ phone: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-2">
                <Label>City</Label>
                <Input value={data.location.city} onChange={(e) => update({ location: { ...data.location, city: e.target.value } })} />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Country</Label>
                <Input value={data.location.country} onChange={(e) => update({ location: { ...data.location, country: e.target.value } })} />
              </div>
            </div>
          </div>
        </Section>

        {/* Links */}
        <Section title="Links">
          <div className="grid sm:grid-cols-3 gap-5">
            <div className="flex flex-col gap-2">
              <Label>LinkedIn</Label>
              <Input value={data.links.linkedin} onChange={(e) => update({ links: { ...data.links, linkedin: e.target.value } })} />
            </div>
            <div className="flex flex-col gap-2">
              <Label>GitHub</Label>
              <Input value={data.links.github} onChange={(e) => update({ links: { ...data.links, github: e.target.value } })} />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Portfolio</Label>
              <Input value={data.links.portfolio} onChange={(e) => update({ links: { ...data.links, portfolio: e.target.value } })} />
            </div>
          </div>
        </Section>

        {/* Summary */}
        <Section title="Summary">
          <Textarea rows={3} value={data.summary} onChange={(e) => update({ summary: e.target.value })} placeholder="A short professional summary" />
        </Section>

        {/* Experience */}
        <Section title="Experience" onAdd={() => update({ experience: [...data.experience, emptyExperience()] })}>
          <div className="flex flex-col gap-6">
            {data.experience.length === 0 && <p className="text-sm text-muted-foreground">No experience yet. Add one.</p>}
            {data.experience.map((exp, i) => (
              <div key={i} className="rounded-lg border border-foreground/10 p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-mono text-[11px] tracking-widest text-muted-foreground uppercase">Role {i + 1}</span>
                  <button onClick={() => update({ experience: data.experience.filter((_, idx) => idx !== i) })} className="text-muted-foreground hover:text-red-600 cursor-pointer">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="grid sm:grid-cols-2 gap-4 mb-4">
                  <Input value={exp.title} onChange={(e) => setExp(i, { title: e.target.value })} placeholder="Title" />
                  <Input value={exp.company} onChange={(e) => setExp(i, { company: e.target.value })} placeholder="Company" />
                  <Input value={exp.start} onChange={(e) => setExp(i, { start: e.target.value })} placeholder="Start (YYYY-MM)" />
                  <Input value={exp.end} onChange={(e) => setExp(i, { end: e.target.value })} placeholder="End (YYYY-MM or present)" />
                  <Input value={exp.location} onChange={(e) => setExp(i, { location: e.target.value })} placeholder="Location" className="sm:col-span-2" />
                </div>
                <Label>Bullets</Label>
                <div className="flex flex-col gap-2 mt-2">
                  {exp.bullets.map((b, bi) => (
                    <div key={bi} className="flex items-start gap-2">
                      <Textarea
                        rows={2}
                        value={b}
                        onChange={(e) => setExp(i, { bullets: exp.bullets.map((x, idx) => (idx === bi ? e.target.value : x)) })}
                        placeholder="Achievement or responsibility"
                      />
                      <button onClick={() => setExp(i, { bullets: exp.bullets.filter((_, idx) => idx !== bi) })} className="mt-2 text-muted-foreground hover:text-red-600 cursor-pointer">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  <button onClick={() => setExp(i, { bullets: [...exp.bullets, ""] })} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground cursor-pointer self-start">
                    <Plus className="w-4 h-4" /> Add bullet
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* Education */}
        <Section title="Education" onAdd={() => update({ education: [...data.education, emptyEducation()] })}>
          <div className="flex flex-col gap-4">
            {data.education.length === 0 && <p className="text-sm text-muted-foreground">No education yet. Add one.</p>}
            {data.education.map((ed, i) => (
              <div key={i} className="rounded-lg border border-foreground/10 p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-mono text-[11px] tracking-widest text-muted-foreground uppercase">Entry {i + 1}</span>
                  <button onClick={() => update({ education: data.education.filter((_, idx) => idx !== i) })} className="text-muted-foreground hover:text-red-600 cursor-pointer">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <Input value={ed.institution} onChange={(e) => setEdu(i, { institution: e.target.value })} placeholder="Institution" />
                  <Input value={ed.degree} onChange={(e) => setEdu(i, { degree: e.target.value })} placeholder="Degree" />
                  <Input value={ed.field} onChange={(e) => setEdu(i, { field: e.target.value })} placeholder="Field of study" />
                  <Input value={ed.location} onChange={(e) => setEdu(i, { location: e.target.value })} placeholder="Location" />
                  <Input value={ed.start} onChange={(e) => setEdu(i, { start: e.target.value })} placeholder="Start" />
                  <Input value={ed.end} onChange={(e) => setEdu(i, { end: e.target.value })} placeholder="End" />
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* Skills */}
        <Section title="Skills">
          <ChipList items={data.skills} onChange={(skills) => update({ skills })} placeholder="Type a skill and press Enter" />
        </Section>

        {/* Certifications */}
        <Section title="Certifications">
          <ChipList items={data.certifications} onChange={(certifications) => update({ certifications })} placeholder="Type a certification and press Enter" />
        </Section>

        {/* Languages */}
        <Section title="Languages" onAdd={() => update({ languages: [...data.languages, emptyLanguage()] })}>
          <div className="flex flex-col gap-3">
            {data.languages.length === 0 && <p className="text-sm text-muted-foreground">No languages yet. Add one.</p>}
            {data.languages.map((l, i) => (
              <div key={i} className="flex items-center gap-3">
                <Input value={l.language} onChange={(e) => update({ languages: data.languages.map((x, idx) => (idx === i ? { ...x, language: e.target.value } : x)) })} placeholder="Language" />
                <Input value={l.proficiency} onChange={(e) => update({ languages: data.languages.map((x, idx) => (idx === i ? { ...x, proficiency: e.target.value } : x)) })} placeholder="Proficiency" />
                <button onClick={() => update({ languages: data.languages.filter((_, idx) => idx !== i) })} className="text-muted-foreground hover:text-red-600 cursor-pointer">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </Section>

        <div className="flex items-center gap-3 pb-4">
          <Button onClick={save} disabled={saving || !dirty} className="rounded-lg bg-foreground text-background hover:bg-foreground/90 cursor-pointer">
            {saving ? "Saving…" : "Save changes"}
          </Button>
          {savedAt && !dirty && <span className="text-sm text-muted-foreground">Saved</span>}
        </div>
      </div>
    </main>
  );
}
