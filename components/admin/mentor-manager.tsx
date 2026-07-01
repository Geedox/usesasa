"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Upload } from "lucide-react";

export type MentorRow = {
  id: string;
  name: string;
  title: string | null;
  calLink: string | null;
  expertise: string[] | null;
  active: boolean;
  fromApplication: boolean;
  linked: boolean;
  userEmail: string | null;
};

// Add a mentor manually (linked to their user account), toggle active, link a user.
export function MentorManager({ mentors }: { mentors: MentorRow[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [title, setTitle] = useState("");
  const [calLink, setCalLink] = useState("");
  const [expertise, setExpertise] = useState("");
  const [bio, setBio] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const photoRef = useRef<HTMLInputElement>(null);

  const uploadPhoto = async (file: File) => {
    setError(null);
    setUploadingPhoto(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("folder", "mentor-photos");
      const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Photo upload failed.");
        return;
      }
      setPhotoUrl(data.url);
    } catch {
      setError("Photo upload failed.");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const create = async () => {
    if (!name.trim()) return setError("Name is required.");
    if (!email.trim()) return setError("Enter the mentor's account email.");
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/mentors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, userEmail: email, title, calLink, expertise, bio, photoUrl }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not add mentor.");
        return;
      }
      setName(""); setEmail(""); setTitle(""); setCalLink(""); setExpertise(""); setBio(""); setPhotoUrl("");
      setOpen(false);
      router.refresh();
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  };

  const toggleActive = async (m: MentorRow) => {
    setBusyId(m.id);
    try {
      await fetch(`/api/admin/mentors/${m.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !m.active }),
      });
      router.refresh();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-display text-2xl">Mentors</h1>
        <button onClick={() => setOpen((v) => !v)} className="inline-flex items-center gap-2 rounded-lg bg-foreground text-background px-4 h-9 text-sm cursor-pointer hover:bg-foreground/90">
          <Plus className="h-4 w-4" /> Add mentor
        </button>
      </div>

      {open && (
        <div className="rounded-2xl border border-foreground/10 bg-background p-5 mb-6 grid gap-3 sm:grid-cols-2">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name *" className="rounded-lg border border-foreground/15 bg-background h-10 px-3 text-sm outline-none focus:border-foreground/40" />
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="Mentor account email *" className="rounded-lg border border-foreground/15 bg-background h-10 px-3 text-sm outline-none focus:border-foreground/40" />
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title (e.g. Staff Engineer)" className="rounded-lg border border-foreground/15 bg-background h-10 px-3 text-sm outline-none focus:border-foreground/40" />
          <input value={calLink} onChange={(e) => setCalLink(e.target.value)} placeholder="Cal event link (optional)" className="rounded-lg border border-foreground/15 bg-background h-10 px-3 text-sm outline-none focus:border-foreground/40" />
          <input value={expertise} onChange={(e) => setExpertise(e.target.value)} placeholder="Expertise (comma separated)" className="rounded-lg border border-foreground/15 bg-background h-10 px-3 text-sm outline-none focus:border-foreground/40" />
          <div className="sm:col-span-2 flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <span className="h-12 w-12 shrink-0 overflow-hidden rounded-full bg-foreground/[0.06] flex items-center justify-center">
              {photoUrl ? <img src={photoUrl} alt="" className="h-full w-full object-cover" /> : <span className="text-xs text-muted-foreground">Photo</span>}
            </span>
            <button
              type="button"
              onClick={() => photoRef.current?.click()}
              disabled={uploadingPhoto}
              className="inline-flex items-center gap-2 rounded-lg border border-foreground/15 px-4 h-10 text-sm cursor-pointer hover:border-foreground/40 disabled:opacity-50"
            >
              {uploadingPhoto ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {uploadingPhoto ? "Uploading…" : photoUrl ? "Change photo" : "Upload photo"}
            </button>
            <input
              ref={photoRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadPhoto(f);
              }}
            />
          </div>
          <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={2} placeholder="Short bio (optional)" className="sm:col-span-2 rounded-lg border border-foreground/15 bg-background px-3 py-2 text-sm outline-none focus:border-foreground/40 resize-y" />
          {error && <p className="sm:col-span-2 text-sm text-rose-600">{error}</p>}
          <div className="sm:col-span-2">
            <button onClick={create} disabled={loading} className="inline-flex items-center gap-2 rounded-lg bg-foreground text-background px-5 h-10 text-sm cursor-pointer hover:bg-foreground/90 disabled:opacity-50">
              {loading && <Loader2 className="h-4 w-4 animate-spin" />} Save mentor
            </button>
          </div>
        </div>
      )}

      {mentors.length === 0 ? (
        <p className="text-sm text-muted-foreground">No mentors yet. Add one above.</p>
      ) : (
        <div className="grid gap-2">
          {mentors.map((m) => (
            <div key={m.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-foreground/10 bg-background p-4">
              <div className="min-w-0 flex-1">
                <div className="font-medium">{m.name}{m.fromApplication && <span className="ml-2 text-xs text-muted-foreground">(from application)</span>}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {[m.title, m.calLink, (m.expertise ?? []).join(", ")].filter(Boolean).join(" · ") || "No details"}
                </div>
                {m.linked ? (
                  <div className="text-xs text-emerald-600 mt-0.5">Linked to {m.userEmail}</div>
                ) : (
                  <LinkUser mentorId={m.id} onDone={() => router.refresh()} />
                )}
              </div>
              <span className={`text-xs ${m.active ? "text-emerald-600" : "text-muted-foreground"}`}>{m.active ? "Active" : "Inactive"}</span>
              <button onClick={() => toggleActive(m)} disabled={busyId === m.id} className="rounded-lg border border-foreground/15 px-3 h-8 text-sm cursor-pointer hover:border-foreground/40 disabled:opacity-50">
                {busyId === m.id ? "…" : m.active ? "Deactivate" : "Activate"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Inline control to link an existing (unlinked) mentor to a user account by email.
function LinkUser({ mentorId, onDone }: { mentorId: string; onDone: () => void }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const link = async () => {
    if (!email.trim()) return;
    setBusy(true); setErr(null);
    try {
      const res = await fetch(`/api/admin/mentors/${mentorId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userEmail: email }),
      });
      const data = await res.json();
      if (!res.ok) { setErr(data.error || "Could not link."); return; }
      onDone();
    } catch { setErr("Network error."); }
    finally { setBusy(false); }
  };
  return (
    <div className="mt-1 flex items-center gap-2">
      <span className="text-xs text-amber-600">No user linked</span>
      <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="account email" className="rounded-md border border-foreground/15 bg-background h-7 px-2 text-xs outline-none focus:border-foreground/40" />
      <button onClick={link} disabled={busy} className="rounded-md border border-foreground/15 px-2 h-7 text-xs cursor-pointer hover:border-foreground/40 disabled:opacity-50">
        {busy ? "…" : "Link"}
      </button>
      {err && <span className="text-xs text-rose-600">{err}</span>}
    </div>
  );
}
