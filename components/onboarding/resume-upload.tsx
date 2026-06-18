"use client";

import { useRef, useState } from "react";
import { UploadCloud, Check, FileText, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const MAX_BYTES = 10 * 1024 * 1024;

const points = [
  "We read your skills, roles, and dates straight from the PDF.",
  "A first cover letter is drafted from your real experience.",
  "Matches are ready by the time you finish setup.",
];

export function ResumeUpload({ onUploaded }: { onUploaded: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [referral, setReferral] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const accept = (f: File | undefined | null) => {
    setError("");
    if (!f) return;
    if (f.type !== "application/pdf") {
      setError("Please choose a PDF file.");
      return;
    }
    if (f.size > MAX_BYTES) {
      setError("That file is larger than 10MB.");
      return;
    }
    setFile(f);
  };

  const onContinue = async () => {
    if (!file) {
      setError("Add your CV to continue.");
      return;
    }
    setUploading(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      if (referral.trim()) fd.append("referralCode", referral.trim());
      const res = await fetch("/api/onboarding/cv", { method: "POST", body: fd });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || "Upload failed. Please try again.");
      }
      onUploaded();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-4xl rounded-2xl border border-foreground/10 bg-background shadow-sm overflow-hidden">
        <div className="grid md:grid-cols-[300px_1fr]">
          {/* Left: getting started */}
          <aside className="p-8 lg:p-10 border-b md:border-b-0 md:border-r border-foreground/10">
            <p className="font-mono text-xs tracking-widest text-muted-foreground uppercase mb-5">
              Getting started
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed mb-8">
              Upload your CV and we'll pull out your profile, draft a cover letter, and line up jobs
              that fit you. It takes about a minute.
            </p>
            <ul className="space-y-4">
              {points.map((p) => (
                <li key={p} className="flex items-start gap-3">
                  <Check className="w-4 h-4 mt-0.5 shrink-0 text-foreground" />
                  <span className="text-sm text-muted-foreground leading-relaxed">{p}</span>
                </li>
              ))}
            </ul>
          </aside>

          {/* Right: upload */}
          <section className="p-8 lg:p-12">
            <p className="font-mono text-xs tracking-widest text-muted-foreground uppercase mb-3">
              Your CV
            </p>
            <h1 className="font-display text-4xl lg:text-5xl tracking-tight mb-3">Upload your CV.</h1>
            <p className="text-muted-foreground leading-relaxed mb-8">
              PDF only, up to 10MB. We parse it, draft a cover letter, and have matches waiting by the
              time you finish setup.
            </p>

            <input
              ref={inputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => accept(e.target.files?.[0])}
            />

            {file ? (
              <div className="flex items-center justify-between gap-4 rounded-xl border border-foreground/15 px-5 py-4">
                <div className="flex items-center gap-3 min-w-0">
                  <FileText className="w-5 h-5 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{file.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setFile(null)}
                  className="text-muted-foreground hover:text-foreground cursor-pointer"
                  aria-label="Remove file"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  accept(e.dataTransfer.files?.[0]);
                }}
                className={`w-full rounded-xl border border-dashed px-6 py-14 flex flex-col items-center justify-center text-center transition-colors cursor-pointer ${
                  dragOver ? "border-foreground bg-foreground/[0.03]" : "border-foreground/20 hover:border-foreground/40"
                }`}
              >
                <UploadCloud className="w-9 h-9 text-muted-foreground mb-4" />
                <div className="text-base">
                  Drop your PDF here, or <span className="underline underline-offset-4">browse</span>
                </div>
                <div className="text-xs text-muted-foreground mt-2">CV · PDF only · up to 10MB</div>
              </button>
            )}

            {/* Referral code */}
            <div className="mt-8">
              <label htmlFor="referral" className="font-mono text-xs tracking-widest text-muted-foreground uppercase block mb-3">
                Referral code · optional
              </label>
              <Input
                id="referral"
                value={referral}
                onChange={(e) => setReferral(e.target.value)}
                placeholder="e.g. SAMUEL1234"
                className="max-w-xs"
              />
            </div>

            {error && <p className="text-sm text-red-600 mt-6">{error}</p>}

            <div className="mt-10 flex items-center gap-4">
              <Button
                onClick={onContinue}
                disabled={uploading || !file}
                className="h-12 px-7 rounded-lg bg-foreground text-background hover:bg-foreground/90 cursor-pointer"
              >
                {uploading ? "Uploading…" : "Continue"}
              </Button>
              <span className="text-sm text-muted-foreground">Takes about 30 seconds</span>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
