"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Check, Upload, FileText } from "lucide-react";

// Form for a logged-in user to apply to take interviews. Resume + LinkedIn + links
// + a short pitch. Shown when the user has no open application (or was rejected).
export function MentorApply({
  defaults,
}: {
  defaults: { photoUrl: string; resumeUrl: string; linkedinUrl: string; otherLinks: string; pitch: string };
}) {
  const router = useRouter();
  const [photoUrl, setPhotoUrl] = useState(defaults.photoUrl);
  const [resumeUrl, setResumeUrl] = useState(defaults.resumeUrl);
  const [linkedinUrl, setLinkedinUrl] = useState(defaults.linkedinUrl);
  const [otherLinks, setOtherLinks] = useState(defaults.otherLinks);
  const [pitch, setPitch] = useState(defaults.pitch);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadedName, setUploadedName] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);

  const uploadPhoto = async (file: File) => {
    setError(null);
    setUploadingPhoto(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/mentor-applications/photo", { method: "POST", body: fd });
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

  const upload = async (file: File) => {
    setError(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/mentor-applications/resume", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Upload failed.");
        return;
      }
      setResumeUrl(data.url);
      setUploadedName(file.name);
    } catch {
      setError("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/mentor-applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoUrl, resumeUrl, linkedinUrl, otherLinks, pitch }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not submit your application.");
        return;
      }
      setDone(true);
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="rounded-2xl border border-foreground/10 bg-background p-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
          <Check className="h-6 w-6" />
        </div>
        <h3 className="font-display text-xl mb-1">Application received</h3>
        <p className="text-sm text-muted-foreground">We will review it and let you know by email and Telegram.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-foreground/10 bg-background p-6">
      <div className="grid gap-3">
        <div className="flex flex-col gap-1">
          <span className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">Profile photo</span>
          <div className="flex items-center gap-3">
            <span className="h-16 w-16 shrink-0 overflow-hidden rounded-full bg-foreground/[0.06] flex items-center justify-center">
              {photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photoUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="text-xs text-muted-foreground">Photo</span>
              )}
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
        </div>
        <div className="flex flex-col gap-1">
          <span className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">Resume</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center gap-2 rounded-lg border border-foreground/15 px-4 h-10 text-sm cursor-pointer hover:border-foreground/40 disabled:opacity-50"
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {uploading ? "Uploading…" : "Upload resume"}
            </button>
            {uploadedName && (
              <span className="inline-flex items-center gap-1.5 text-sm text-emerald-700 min-w-0">
                <FileText className="h-4 w-4 shrink-0" />
                <span className="truncate">{uploadedName}</span>
              </span>
            )}
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) upload(f);
              }}
            />
          </div>
          <span className="text-xs text-muted-foreground mt-1">PDF or Word, up to 10MB. Or paste a link below.</span>
          <input
            value={resumeUrl}
            onChange={(e) => {
              setResumeUrl(e.target.value);
              setUploadedName(null);
            }}
            placeholder="Link to your CV (Drive, Dropbox, personal site)"
            className="mt-1 rounded-lg border border-foreground/15 bg-background h-10 px-3 text-sm outline-none focus:border-foreground/40"
          />
        </div>
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">LinkedIn</span>
          <input
            value={linkedinUrl}
            onChange={(e) => setLinkedinUrl(e.target.value)}
            placeholder="https://linkedin.com/in/you"
            className="rounded-lg border border-foreground/15 bg-background h-10 px-3 text-sm outline-none focus:border-foreground/40"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">Other links</span>
          <input
            value={otherLinks}
            onChange={(e) => setOtherLinks(e.target.value)}
            placeholder="GitHub, portfolio, talks (comma separated)"
            className="rounded-lg border border-foreground/15 bg-background h-10 px-3 text-sm outline-none focus:border-foreground/40"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">Why you</span>
          <textarea
            value={pitch}
            onChange={(e) => setPitch(e.target.value)}
            rows={4}
            placeholder="Your background, the roles you can interview for, and why you would be a great mentor."
            className="rounded-lg border border-foreground/15 bg-background px-3 py-2 text-sm outline-none focus:border-foreground/40 resize-y"
          />
        </label>
      </div>

      {error && <p className="text-sm text-rose-600 mt-3">{error}</p>}

      <button
        onClick={submit}
        disabled={loading}
        className="mt-4 inline-flex items-center gap-2 rounded-lg bg-foreground text-background px-5 h-10 text-sm cursor-pointer hover:bg-foreground/90 disabled:opacity-50"
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {loading ? "Submitting…" : "Submit application"}
      </button>
    </div>
  );
}
