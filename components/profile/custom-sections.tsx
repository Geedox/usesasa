"use client";

import { useState } from "react";
import { Plus, X, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { CustomSection, Profile } from "@/lib/profile";

type Format = "structured" | "bullets";
type StructItem = { title: string; subtitle: string; start: string; end: string; bullets: string[] };

const emptyStruct = (): StructItem => ({ title: "", subtitle: "", start: "", end: "", bullets: [""] });

function Label({ children }: { children: React.ReactNode }) {
  return <span className="font-mono text-[11px] tracking-widest text-muted-foreground uppercase">{children}</span>;
}

export function CustomSections({ profile }: { profile: Profile }) {
  const [sections, setSections] = useState<CustomSection[]>(profile.customSections ?? []);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // modal draft
  const [title, setTitle] = useState("");
  const [format, setFormat] = useState<Format>("structured");
  const [structItems, setStructItems] = useState<StructItem[]>([]);
  const [bulletItems, setBulletItems] = useState<string[]>([]);

  const resetDraft = () => {
    setTitle("");
    setFormat("structured");
    setStructItems([]);
    setBulletItems([]);
    setError("");
  };

  const persist = async (next: CustomSection[]) => {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...profile, customSections: next }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b?.error || "Could not save. Please try again.");
      }
      setSections(next);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const onSave = async () => {
    if (!title.trim()) {
      setError("Section title is required.");
      return;
    }
    const section: CustomSection = {
      id: crypto.randomUUID(),
      title: title.trim(),
      format,
      structuredItems: format === "structured" ? structItems : [],
      bulletItems: format === "bullets" ? bulletItems.filter((b) => b.trim()) : [],
    };
    const ok = await persist([...sections, section]);
    if (ok) {
      setOpen(false);
      resetDraft();
    }
  };

  const remove = (id: string) => persist(sections.filter((s) => s.id !== id));

  return (
    <div id="custom" className="scroll-mt-6 flex flex-col gap-5">
      {sections.map((s) => (
        <section key={s.id} className="rounded-xl border border-foreground/10 bg-background p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-xl tracking-tight">{s.title}</h2>
            <button onClick={() => remove(s.id)} className="text-muted-foreground hover:text-red-600 cursor-pointer" aria-label="Remove section">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
          {s.format === "bullets" ? (
            <ul className="space-y-1.5">
              {s.bulletItems.map((b, i) => (
                <li key={i} className="text-sm text-muted-foreground flex gap-2"><span className="text-foreground/30">•</span><span>{b}</span></li>
              ))}
            </ul>
          ) : (
            <div className="flex flex-col gap-4">
              {s.structuredItems.map((it, i) => (
                <div key={i}>
                  <div className="font-medium">{it.title}</div>
                  {it.subtitle && <div className="text-sm text-muted-foreground">{it.subtitle}</div>}
                  {(it.start || it.end) && <div className="text-xs text-muted-foreground mt-0.5">{[it.start, it.end].filter(Boolean).join(" – ")}</div>}
                  {it.bullets.filter(Boolean).length > 0 && (
                    <ul className="mt-1.5 space-y-1">
                      {it.bullets.filter(Boolean).map((b, bi) => (
                        <li key={bi} className="text-sm text-muted-foreground flex gap-2"><span className="text-foreground/30">•</span><span>{b}</span></li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      ))}

      <button
        onClick={() => { resetDraft(); setOpen(true); }}
        className="rounded-xl border border-dashed border-foreground/20 py-5 text-sm text-muted-foreground hover:border-foreground/40 hover:text-foreground cursor-pointer inline-flex items-center justify-center gap-2"
      >
        <Plus className="w-4 h-4" /> Add custom section
      </button>

      {error && !open && <p className="text-sm text-red-600">{error}</p>}

      {/* Modal */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">New custom section</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-6 mt-2">
            {/* Title */}
            <div className="flex flex-col gap-2">
              <Label>Section title *</Label>
              <Input
                value={title}
                onChange={(e) => { setTitle(e.target.value); setError(""); }}
                placeholder="e.g. Volunteer experience, Awards"
                className={!title.trim() && error ? "border-red-400" : ""}
              />
              {!title.trim() && error && <span className="text-xs text-red-600">Required</span>}
            </div>

            {/* Format */}
            <div className="flex flex-col gap-2">
              <Label>Format</Label>
              <div className="grid sm:grid-cols-2 gap-3">
                {([
                  { v: "structured", t: "Structured", d: "Title, subtitle, dates, bullets" },
                  { v: "bullets", t: "Bullet list", d: "Simple list of items" },
                ] as const).map((o) => (
                  <button
                    key={o.v}
                    type="button"
                    onClick={() => setFormat(o.v)}
                    className={`rounded-lg border px-4 py-3 text-left transition-colors cursor-pointer ${
                      format === o.v ? "border-foreground bg-foreground/[0.04]" : "border-foreground/15 hover:border-foreground/40"
                    }`}
                  >
                    <div className="text-sm font-medium">{o.t}</div>
                    <div className="text-sm text-muted-foreground">{o.d}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Items */}
            <div className="flex flex-col gap-3">
              <Label>Items</Label>

              {format === "bullets" ? (
                <div className="flex flex-col gap-2">
                  {bulletItems.map((b, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Input value={b} onChange={(e) => setBulletItems(bulletItems.map((x, idx) => (idx === i ? e.target.value : x)))} placeholder="List item" />
                      <button onClick={() => setBulletItems(bulletItems.filter((_, idx) => idx !== i))} className="text-muted-foreground hover:text-red-600 cursor-pointer"><X className="w-4 h-4" /></button>
                    </div>
                  ))}
                  <button onClick={() => setBulletItems([...bulletItems, ""])} className="rounded-lg border border-dashed border-foreground/20 py-3 text-sm text-muted-foreground hover:border-foreground/40 cursor-pointer inline-flex items-center justify-center gap-2">
                    <Plus className="w-4 h-4" /> Add item
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {structItems.map((it, i) => (
                    <div key={i} className="rounded-lg border border-foreground/10 p-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-mono text-[11px] tracking-widest text-muted-foreground uppercase">Item {i + 1}</span>
                        <button onClick={() => setStructItems(structItems.filter((_, idx) => idx !== i))} className="text-muted-foreground hover:text-red-600 cursor-pointer"><Trash2 className="w-4 h-4" /></button>
                      </div>
                      <div className="grid sm:grid-cols-2 gap-3 mb-3">
                        <Input value={it.title} onChange={(e) => setStructItems(structItems.map((x, idx) => idx === i ? { ...x, title: e.target.value } : x))} placeholder="Title" />
                        <Input value={it.subtitle} onChange={(e) => setStructItems(structItems.map((x, idx) => idx === i ? { ...x, subtitle: e.target.value } : x))} placeholder="Subtitle" />
                        <Input value={it.start} onChange={(e) => setStructItems(structItems.map((x, idx) => idx === i ? { ...x, start: e.target.value } : x))} placeholder="Start" />
                        <Input value={it.end} onChange={(e) => setStructItems(structItems.map((x, idx) => idx === i ? { ...x, end: e.target.value } : x))} placeholder="End" />
                      </div>
                      {it.bullets.map((b, bi) => (
                        <div key={bi} className="flex items-center gap-2 mb-2">
                          <Input value={b} onChange={(e) => setStructItems(structItems.map((x, idx) => idx === i ? { ...x, bullets: x.bullets.map((y, yi) => yi === bi ? e.target.value : y) } : x))} placeholder="Bullet" />
                          <button onClick={() => setStructItems(structItems.map((x, idx) => idx === i ? { ...x, bullets: x.bullets.filter((_, yi) => yi !== bi) } : x))} className="text-muted-foreground hover:text-red-600 cursor-pointer"><X className="w-4 h-4" /></button>
                        </div>
                      ))}
                      <button onClick={() => setStructItems(structItems.map((x, idx) => idx === i ? { ...x, bullets: [...x.bullets, ""] } : x))} className="text-sm text-muted-foreground hover:text-foreground cursor-pointer inline-flex items-center gap-1.5"><Plus className="w-4 h-4" /> Add bullet</button>
                    </div>
                  ))}
                  <button onClick={() => setStructItems([...structItems, emptyStruct()])} className="rounded-lg border border-dashed border-foreground/20 py-3 text-sm text-muted-foreground hover:border-foreground/40 cursor-pointer inline-flex items-center justify-center gap-2">
                    <Plus className="w-4 h-4" /> Add item
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-4 mt-6 pt-4 border-t border-foreground/10">
            {!title.trim() && <span className="text-sm text-red-600">Fill required fields</span>}
            <Button variant="outline" className="rounded-lg cursor-pointer" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={onSave} disabled={saving || !title.trim()} className="rounded-lg bg-foreground text-background hover:bg-foreground/90 cursor-pointer">
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
