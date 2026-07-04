"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, AlertTriangle, Download, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { diffWords } from "@/lib/diff";

type RoleCv = { company: string; title: string; originalTitle?: string; originalBullets: string[]; rewrittenBullets: string[] };
type Answers = { whyCompany: string; whyRole: string; recentProject: string };

export function ApplicationReview({
  applicationId,
  job,
  summary: initialSummary,
  skills,
  experience,
  coverLetter: initialCover,
  answers: initialAnswers,
  validation,
  state,
  submissionNote,
  submissionViewUrl,
  awaitingCode,
  submissionLog,
}: {
  applicationId: string;
  job: { title: string; company: string; location: string };
  summary: string;
  skills: string[];
  experience: RoleCv[];
  coverLetter: string;
  answers: Answers;
  validation: { clean: boolean; fabrications: string[]; embellished?: boolean };
  state: string;
  submissionNote?: string;
  submissionViewUrl?: string;
  awaitingCode?: boolean;
  submissionLog?: { label: string; at: number; status: "active" | "done" | "error" }[];
}) {
  const router = useRouter();
  const [roles, setRoles] = useState<RoleCv[]>(experience);
  const [summary, setSummary] = useState(initialSummary);
  const [coverLetter, setCoverLetter] = useState(initialCover);
  const [answers, setAnswers] = useState<Answers>(initialAnswers);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [approving, setApproving] = useState(false);
  const [error, setError] = useState("");
  const [code, setCode] = useState("");
  const [submittingCode, setSubmittingCode] = useState(false);
  const [codeMsg, setCodeMsg] = useState("");
  const [retrying, setRetrying] = useState(false);
  // Show the "starting the browser" panel the instant the user approves/retries,
  // before the server state has caught up, so the page reacts immediately.
  const [optimisticQueued, setOptimisticQueued] = useState(false);

  // The effective state that drives the UI. When the user has just approved/retried we
  // show "queued" immediately; the clearing effect below drops this the moment the
  // server reports real progress (sending/submitted) or a stop (failed/needs_user).
  const effState = optimisticQueued ? "queued" : state;
  const live = effState === "queued" || effState === "sending";

  // The Steel live session is short-lived. If the user comes back after it has
  // expired, re-approving opens a FRESH cloud browser and re-fills the form, so they
  // can finish. Nothing was charged for the paused attempt; the credit is only taken
  // when a submission actually completes.
  const retryInFreshBrowser = async () => {
    setRetrying(true);
    setError("");
    try {
      const res = await fetch(`/api/applications/${applicationId}/approve`, { method: "POST" });
      if (!res.ok) throw new Error("Could not restart the submission.");
      setOptimisticQueued(true);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setRetrying(false);
    }
  };

  const submitCode = async () => {
    setSubmittingCode(true);
    setCodeMsg("");
    try {
      const res = await fetch(`/api/applications/${applicationId}/code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const j = await res.json().catch(() => ({}));
      if (j.ok) router.refresh();
      else setCodeMsg(j.reason || j.error || "That code did not complete it. Check it and try again.");
    } catch {
      setCodeMsg("Could not reach the server. Try again.");
    } finally {
      setSubmittingCode(false);
    }
  };

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

  // While a submission is in flight (or just queued), auto-refresh so the live
  // browser and status appear and update without the user reloading the page.
  useEffect(() => {
    if (!live) return;
    const id = setInterval(() => router.refresh(), 3000);
    return () => clearInterval(id);
  }, [live, router]);

  // Once the server reports a real terminal/in-flight state, drop the optimistic flag
  // so the UI follows the truth (e.g. a fresh session that came back needs_user/failed).
  useEffect(() => {
    if (["sending", "submitted", "failed", "needs_user"].includes(state)) setOptimisticQueued(false);
  }, [state]);

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
        body: JSON.stringify({ tailoredCv: { summary, skills, experience: roles }, coverLetterText: coverLetter, customAnswers: answers }),
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
      // Stay on the page and show the live cloud browser + progress inline, instead
      // of bouncing to the dashboard.
      setOptimisticQueued(true);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
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

      {/* Paused for an emailed verification code — ask the user for it. */}
      {!live && state === "needs_user" && awaitingCode && (
        <div className="rounded-xl border border-blue-300 bg-blue-50 p-4 mb-8">
          <div className="font-medium text-blue-900 mb-1">Enter the code from your email</div>
          <p className="text-sm text-blue-900/80 mb-3">{submissionNote || "This employer emailed you a verification code to finish the application."}</p>
          <div className="flex items-center gap-2 flex-wrap">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Verification code"
              className="border border-blue-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500 bg-white"
            />
            <Button onClick={submitCode} disabled={submittingCode || !code.trim()} className="h-10 px-5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 cursor-pointer">
              {submittingCode ? "Entering…" : "Enter code & finish"}
            </Button>
          </div>
          {codeMsg && <p className="text-sm text-red-600 mt-2">{codeMsg}</p>}
          {submissionViewUrl && (
            <div className="mt-4 rounded-lg border border-blue-200 overflow-hidden bg-white" style={{ aspectRatio: "16 / 10" }}>
              <iframe src={submissionViewUrl} className="w-full h-full" title="Live application browser" />
            </div>
          )}
          <p className="text-sm text-blue-900/80 mt-3">
            If the browser above says the session expired, start a fresh one and we will re-fill it for you.
          </p>
          <Button
            onClick={retryInFreshBrowser}
            disabled={retrying}
            variant="outline"
            className="mt-2 h-10 px-5 rounded-lg border-blue-300 text-blue-800 hover:bg-blue-100 cursor-pointer"
          >
            {retrying ? "Starting…" : "Start a fresh browser"}
          </Button>
        </div>
      )}

      {!live && submissionNote && ((state === "needs_user" && !awaitingCode) || state === "failed") && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 mb-8">
          <div className="flex items-center gap-2 text-amber-800 font-medium mb-2">
            <AlertTriangle className="w-4 h-4" /> Could not finish submitting
          </div>
          {submissionNote && (
            <p className="text-sm text-amber-900 font-medium bg-amber-100 rounded-lg px-3 py-2 mb-2 break-words">
              Reason: {submissionNote}
            </p>
          )}
          <p className="text-sm text-amber-800">
            {submissionViewUrl ? "Finish it in the live browser below, or start a fresh one to retry." : "Edit below and approve to try again."} Nothing was sent and no credit was used.
          </p>
          {submissionViewUrl && (
            <>
              <div className="mt-4 flex items-center justify-between">
                <p className="text-sm font-medium text-amber-900">Live browser — you can click and type in it</p>
                <a href={submissionViewUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm font-medium text-amber-900 underline underline-offset-4">
                  Open full screen ↗
                </a>
              </div>
              <div className="mt-2 rounded-lg border border-amber-200 overflow-hidden bg-white" style={{ aspectRatio: "16 / 10" }}>
                <iframe src={submissionViewUrl} className="w-full h-full" title="Live application browser" allow="clipboard-write" />
              </div>
              <p className="text-xs text-amber-800 mt-2">
                Tip: open full screen to solve any &quot;verify you are human&quot; check and complete the form. I&apos;ll detect it and charge 1 credit only when it is actually submitted.
              </p>
            </>
          )}
          <Button
            onClick={retryInFreshBrowser}
            disabled={retrying}
            variant="outline"
            className="mt-3 h-10 px-5 rounded-lg border-amber-300 text-amber-800 hover:bg-amber-100 cursor-pointer"
          >
            {retrying ? "Starting…" : "Start a fresh browser & retry"}
          </Button>
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

      {/* Tailored summary + skills */}
      {(initialSummary || skills.length > 0) && (
        <section className="mb-8">
          <h2 className="font-display text-xl tracking-tight mb-4">Summary and skills</h2>
          {initialSummary && (
            <Textarea
              value={summary}
              onChange={(e) => {
                setSummary(e.target.value);
                setDirty(true);
              }}
              rows={4}
              className="mb-4"
            />
          )}
          {skills.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {skills.map((s) => (
                <span key={s} className="rounded-full border border-foreground/15 px-3 py-1 text-sm text-muted-foreground">
                  {s}
                </span>
              ))}
            </div>
          )}
        </section>
      )}

      {/* CV bullets */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-xl tracking-tight">Résumé changes</h2>
          <a
            href={`/api/applications/${applicationId}/resume`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-foreground/15 px-3 py-1.5 text-sm hover:border-foreground/40 cursor-pointer"
          >
            <Download className="w-4 h-4" /> Download PDF
          </a>
        </div>
        <div className="flex flex-col gap-6">
          {roles.map((role, ri) => (
            <div key={ri} className="rounded-xl border border-foreground/10 p-5">
              <div className="font-medium mb-1">
                {role.title}
                {role.originalTitle && role.originalTitle !== role.title && (
                  <span className="ml-2 text-xs font-normal text-amber-700">was {role.originalTitle}</span>
                )}
              </div>
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

      {live || effState === "submitted" ? (
        <div className="pb-6">
          <div className="rounded-lg border border-foreground/10 bg-foreground/[0.03] p-4">
            <p className="text-sm font-medium mb-1 flex items-center gap-2">
              {live && <Loader2 className="w-4 h-4 animate-spin" />}
              {effState === "submitted" ? "Submitted" : effState === "sending" ? "Submitting now" : "Queued for submission"}
            </p>
            <p className="text-sm text-muted-foreground">
              {effState === "submitted"
                ? "This application was submitted for you in the cloud."
                : effState === "sending"
                  ? "Filling and submitting it in a cloud browser now. Watch it live below; take over for a captcha or tricky field anytime."
                  : "Approved and queued. Starting the cloud browser now, this can take a few seconds."}
            </p>
          </div>
          {live && (
            <div className="mt-4 grid lg:grid-cols-[1fr_300px] gap-4">
              {/* Live browser */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium">Live browser</p>
                  {submissionViewUrl && <a href={submissionViewUrl} target="_blank" rel="noreferrer" className="text-sm underline underline-offset-4">Full screen</a>}
                </div>
                {submissionViewUrl ? (
                  <div className="rounded-lg border border-foreground/10 overflow-hidden bg-black/5" style={{ aspectRatio: "16 / 10" }}>
                    <iframe src={submissionViewUrl} className="w-full h-full" title="Live application browser" allow="clipboard-write" />
                  </div>
                ) : (
                  <div className="rounded-lg border border-foreground/10 bg-foreground/[0.03] flex items-center justify-center text-sm text-muted-foreground" style={{ aspectRatio: "16 / 10" }}>
                    <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Starting the browser…</span>
                  </div>
                )}
              </div>
              {/* Streaming progress */}
              <SubmissionActivity steps={submissionLog ?? []} />
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-3 pb-6">
          <Button onClick={approve} disabled={approving || saving} className="h-11 px-6 rounded-lg bg-foreground text-background hover:bg-foreground/90 cursor-pointer">
            {approving ? "Starting…" : "Approve & queue"}
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

// Live progress feed for an in-flight submission — a check for finished steps and
// a spinning loader on the one in progress. Refreshed by the page's polling.
function SubmissionActivity({ steps }: { steps: { label: string; at: number; status: "active" | "done" | "error" }[] }) {
  return (
    <div className="rounded-lg border border-foreground/10 bg-background p-4 h-fit">
      <p className="text-sm font-medium mb-4">Live progress</p>
      {steps.length === 0 ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Getting started…
        </div>
      ) : (
        <ol className="space-y-3">
          {steps.map((s, i) => (
            <li key={i} className="flex items-start gap-3 text-sm">
              <span className="mt-0.5 shrink-0">
                {s.status === "done" ? (
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                ) : s.status === "error" ? (
                  <XCircle className="w-4 h-4 text-red-600" />
                ) : (
                  <Loader2 className="w-4 h-4 animate-spin text-foreground" />
                )}
              </span>
              <span className={s.status === "active" ? "font-medium" : "text-muted-foreground"}>{s.label}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
