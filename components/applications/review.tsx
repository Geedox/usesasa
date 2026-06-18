"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { diffWords } from "@/lib/diff";

type RoleCv = { company: string; title: string; originalBullets: string[]; rewrittenBullets: string[] };
type Answers = { whyCompany: string; whyRole: string; recentProject: string };

export function ApplicationReview({
  applicationId,
  job,
  experience,
  coverLetter: initialCover,
  answers: initialAnswers,
  validation,
  state,
  submissionNote,
}: {
  applicationId: string;
  job: { title: string; company: string; location: string };
  experience: RoleCv[];
  coverLetter: string;
  answers: Answers;
  validation: { clean: boolean; fabrications: string[]; embellished?: boolean };
  state: string;
  submissionNote?: string;
}) {
  const router = useRouter();
  const [roles, setRoles] = useState<RoleCv[]>(experience);
  const [coverLetter, setCoverLetter] = useState(initialCover);
  const [answers, setAnswers] = useState<Answers>(initialAnswers);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [approving, setApproving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  const setBullet = (ri: number, bi: number, val: string) => {
    setRoles((rs) => rs.map((r, i) => (i === ri ? { ...r, rewrittenBullets: r.rewrittenBullets.map((b, j) => (j === bi ? val : b)) } : r)));
    setDirty(true);
  };

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/applications/${applicationId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tailoredCv: { experience: roles }, coverLetterText: coverLetter, customAnswers: answers }),
      });
      if (!res.ok) throw new Error("Could not save.");
      setDirty(false);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const approve = async () => {
    setApproving(true);
    setError("");
    const saved = await save();
    if (!saved) {
      setApproving(false);
      return;
    }
    try {
      const res = await fetch(`/api/applications/${applicationId}/approve`, { method: "POST" });
      if (!res.ok) throw new Error("Could not approve.");
      setDirty(false);
      router.push("/dashboard");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setApproving(false);
    }
  };

  const coverWords = useMemo(() => coverLetter.trim().split(/\s+/).filter(Boolean).length, [coverLetter]);

  return (
    <main className="max-w-3xl mx-auto px-6 lg:px-10 py-8">
      <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6">
        <ArrowLeft className="w-4 h-4" /> Back
      </Link>

      <p className="font-mono text-xs tracking-widest text-muted-foreground uppercase mb-2">Review before sending</p>
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="font-display text-3xl tracking-tight">{job.title}</h1>
        {validation.embellished && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 text-amber-800 px-3 py-1 text-xs font-medium">
            <AlertTriangle className="w-3.5 h-3.5" /> Embellished
          </span>
        )}
      </div>
      <p className="text-muted-foreground mb-6">
        {job.company}
        {job.location ? ` · ${job.location}` : ""}
      </p>

      {validation.embellished && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 mb-8">
          <div className="flex items-center gap-2 text-amber-800 font-medium mb-1">
            <AlertTriangle className="w-4 h-4" /> Skills were added to match this role
          </div>
          <p className="text-sm text-amber-800">
            You turned on embellishment, so this draft may include skills that are not in your profile. The fact
            checker was bypassed. Make sure you can speak to everything here before you approve.
          </p>
        </div>
      )}

      {submissionNote && (state === "needs_user" || state === "failed") && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 mb-8">
          <div className="flex items-center gap-2 text-amber-800 font-medium mb-1">
            <AlertTriangle className="w-4 h-4" /> Could not finish submitting
          </div>
          <p className="text-sm text-amber-800">
            {submissionNote}. Open the job to complete it yourself, or edit below and approve to try again. Nothing was
            sent and no credit was used.
          </p>
        </div>
      )}

      {!validation.clean && validation.fabrications.length > 0 && (
        <div className="rounded-xl border border-red-300 bg-red-50 p-4 mb-8">
          <div className="flex items-center gap-2 text-red-700 font-medium mb-2">
            <AlertTriangle className="w-4 h-4" /> Review these before approving
          </div>
          <p className="text-sm text-red-700 mb-2">
            Our check flagged claims that may not be supported by your profile. Edit them out before you approve.
          </p>
          <ul className="list-disc pl-5 space-y-1 text-sm text-red-700">
            {validation.fabrications.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
        </div>
      )}

      {/* CV bullets */}
      <section className="mb-8">
        <h2 className="font-display text-xl tracking-tight mb-4">Résumé changes</h2>
        <div className="flex flex-col gap-6">
          {roles.map((role, ri) => (
            <div key={ri} className="rounded-xl border border-foreground/10 p-5">
              <div className="font-medium mb-1">{role.title}</div>
              <div className="text-sm text-muted-foreground mb-4">{role.company}</div>
              <div className="flex flex-col gap-5">
                {role.rewrittenBullets.map((b, bi) => (
                  <div key={bi}>
                    <div className="text-sm leading-relaxed mb-2">
                      {diffWords(role.originalBullets[bi] ?? "", b).map((t, k) => (
                        <span
                          key={k}
                          className={
                            t.type === "added"
                              ? "bg-green-100 text-green-900 rounded-sm"
                              : t.type === "removed"
                                ? "bg-red-100 text-red-700 line-through rounded-sm"
                                : ""
                          }
                        >
                          {t.value}
                        </span>
                      ))}
                    </div>
                    <Textarea rows={2} value={b} onChange={(e) => setBullet(ri, bi, e.target.value)} />
                  </div>
                ))}
              </div>
            </div>
          ))}
          {roles.length === 0 && <p className="text-sm text-muted-foreground">No bullet changes.</p>}
        </div>
      </section>

      {/* Cover letter */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-xl tracking-tight">Cover letter</h2>
          <span className={`text-xs ${coverWords < 200 || coverWords > 350 ? "text-amber-600" : "text-muted-foreground"}`}>{coverWords} words</span>
        </div>
        <Textarea rows={10} value={coverLetter} onChange={(e) => { setCoverLetter(e.target.value); setDirty(true); }} />
      </section>

      {/* Answers */}
      <section className="mb-10">
        <h2 className="font-display text-xl tracking-tight mb-4">Application answers</h2>
        <div className="flex flex-col gap-5">
          {([
            ["whyCompany", "Why this company?"],
            ["whyRole", "Why this role?"],
            ["recentProject", "Describe a recent project"],
          ] as const).map(([key, label]) => (
            <div key={key}>
              <div className="text-sm font-medium mb-2">{label}</div>
              <Textarea rows={3} value={answers[key]} onChange={(e) => { setAnswers((a) => ({ ...a, [key]: e.target.value })); setDirty(true); }} />
            </div>
          ))}
        </div>
      </section>

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      {state === "queued" || state === "sending" || state === "submitted" ? (
        <div className="pb-6">
          <div className="rounded-lg border border-foreground/10 bg-foreground/[0.03] p-4">
            <p className="text-sm font-medium mb-1">
              {state === "submitted" ? "Submitted" : state === "sending" ? "Submitting now" : "Queued for submission"}
            </p>
            <p className="text-sm text-muted-foreground">
              {state === "submitted"
                ? "This application was submitted from your browser."
                : "Approved. The Chrome extension submits this from your browser when you run it. Watch the extension popup for progress."}
            </p>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3 pb-6">
          <Button onClick={approve} disabled={approving || saving} className="h-11 px-6 rounded-lg bg-foreground text-background hover:bg-foreground/90 cursor-pointer">
            {approving ? "Approving…" : "Approve & queue"}
          </Button>
          <Button onClick={save} disabled={saving || approving || !dirty} variant="outline" className="h-11 px-5 rounded-lg cursor-pointer">
            {saving ? "Saving…" : "Save"}
          </Button>
          <span className="text-sm text-muted-foreground">Nothing is sent until you approve.</span>
        </div>
      )}
    </main>
  );
}
