"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Calendar, Check } from "lucide-react";
import { CalEmbed } from "@/components/dashboard/cal-embed";

export type ApplicationOption = { id: string; label: string };

// The "book a prep call" panel: give the job context (an existing application or an
// external role), then book a time on the shared Interview Prep calendar. An admin
// assigns the mentor afterward.
export function InterviewPrepBooking({
  applications,
  calOrigin,
  calLink,
  credits,
  cost,
  name,
  email,
}: {
  applications: ApplicationOption[];
  calOrigin: string;
  calLink: string;
  credits: number;
  cost: number;
  name: string;
  email: string;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"applied" | "external">(applications.length ? "applied" : "external");
  const [applicationId, setApplicationId] = useState<string>(applications[0]?.id ?? "");
  const [jobTitle, setJobTitle] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [externalJobUrl, setExternalJobUrl] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [skills, setSkills] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [booking, setBooking] = useState<{ id: string; prefill: { name: string; email: string } } | null>(null);
  const [done, setDone] = useState(false);

  const enough = credits >= cost;
  const configured = !!calOrigin && !!calLink;

  const continueToBooking = async () => {
    setError(null);
    if (mode === "applied" && !applicationId) return setError("Choose which application you are prepping for.");
    if (mode === "external" && !jobTitle.trim() && !companyName.trim() && !externalJobUrl.trim()) {
      return setError("Tell us which role you are prepping for.");
    }
    setLoading(true);
    try {
      const res = await fetch("/api/interview/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(mode === "applied"
            ? { applicationId }
            : { jobTitle, companyName, externalJobUrl, jobDescription }),
          skills,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not start the booking.");
        return;
      }
      setBooking({ id: data.bookingId, prefill: data.prefill });
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Notes carried into the Cal booking so the assigned mentor walks in prepared.
  const notes = [
    jobTitle && `Role: ${jobTitle}`,
    companyName && `Company: ${companyName}`,
    externalJobUrl && `Job link: ${externalJobUrl}`,
    skills && `Skills to focus on: ${skills}`,
    jobDescription && `Job description: ${jobDescription.slice(0, 1500)}`,
  ]
    .filter(Boolean)
    .join("\n");

  if (done) {
    return (
      <div className="rounded-xl border border-foreground/10 bg-background p-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
          <Check className="h-6 w-6" />
        </div>
        <h3 className="font-display text-xl mb-1">You are booked</h3>
        <p className="text-sm text-muted-foreground mb-5">
          Your prep call is confirmed. We will assign one of our senior professionals and send you the details by email and Telegram, then remind you before it starts.
        </p>
        <button
          onClick={() => {
            setDone(false);
            setBooking(null);
            router.refresh();
            if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
          }}
          className="rounded-lg bg-foreground text-background px-5 h-10 text-sm cursor-pointer hover:bg-foreground/90"
        >
          View my interviews
        </button>
      </div>
    );
  }

  if (booking) {
    return (
      <div className="rounded-xl border border-foreground/10 bg-background p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-display text-lg">Pick a time</h3>
            <p className="text-sm text-muted-foreground">Choose a slot below. We charge {cost} credits once your call is confirmed.</p>
          </div>
          <button onClick={() => setBooking(null)} className="text-sm text-muted-foreground hover:text-foreground cursor-pointer">
            Back
          </button>
        </div>
        {configured ? (
          <CalEmbed
            origin={calOrigin}
            calLink={calLink}
            name={booking.prefill.name || name}
            email={booking.prefill.email || email}
            notes={notes}
            bookingId={booking.id}
            onBooked={() => setDone(true)}
          />
        ) : (
          <p className="text-sm text-amber-700">Booking is not configured yet. Set NEXT_PUBLIC_CAL_ORIGIN and NEXT_PUBLIC_CAL_LINK.</p>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-foreground/10 bg-background p-6">
      <h3 className="font-display text-lg mb-1">Book an interview prep call</h3>
      <p className="text-sm text-muted-foreground mb-5">
        Sit with one of our senior professionals to run a mock interview, calm the nerves, and sharpen your answers. {cost} credits per session.
      </p>

      {!enough && (
        <div className="mb-5 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          You need {cost} credits to book. You have {credits}. Top up to continue.
        </div>
      )}

      {/* Job context */}
      <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase mb-2">Which role are you prepping for?</p>
      <div className="flex gap-2 mb-3">
        <button
          onClick={() => setMode("applied")}
          disabled={applications.length === 0}
          className={`rounded-full px-4 py-1.5 text-sm cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
            mode === "applied" ? "bg-foreground text-background" : "border border-foreground/15 text-muted-foreground hover:text-foreground"
          }`}
        >
          A job I applied to
        </button>
        <button
          onClick={() => setMode("external")}
          className={`rounded-full px-4 py-1.5 text-sm cursor-pointer transition-colors ${
            mode === "external" ? "bg-foreground text-background" : "border border-foreground/15 text-muted-foreground hover:text-foreground"
          }`}
        >
          An external job
        </button>
      </div>

      {mode === "applied" ? (
        <select
          value={applicationId}
          onChange={(e) => setApplicationId(e.target.value)}
          className="w-full rounded-lg border border-foreground/15 bg-background h-10 px-3 text-sm outline-none focus:border-foreground/40 cursor-pointer mb-3"
        >
          {applications.map((a) => (
            <option key={a.id} value={a.id}>
              {a.label}
            </option>
          ))}
        </select>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 mb-3">
          <input
            value={jobTitle}
            onChange={(e) => setJobTitle(e.target.value)}
            placeholder="Job title"
            className="rounded-lg border border-foreground/15 bg-background h-10 px-3 text-sm outline-none focus:border-foreground/40"
          />
          <input
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="Company"
            className="rounded-lg border border-foreground/15 bg-background h-10 px-3 text-sm outline-none focus:border-foreground/40"
          />
          <input
            value={externalJobUrl}
            onChange={(e) => setExternalJobUrl(e.target.value)}
            placeholder="Job link (optional)"
            className="sm:col-span-2 rounded-lg border border-foreground/15 bg-background h-10 px-3 text-sm outline-none focus:border-foreground/40"
          />
          <textarea
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
            placeholder="Paste the job description (optional)"
            rows={3}
            className="sm:col-span-2 rounded-lg border border-foreground/15 bg-background px-3 py-2 text-sm outline-none focus:border-foreground/40 resize-y"
          />
        </div>
      )}

      <input
        value={skills}
        onChange={(e) => setSkills(e.target.value)}
        placeholder="Skills or topics to focus on (e.g. system design, behavioral)"
        className="w-full rounded-lg border border-foreground/15 bg-background h-10 px-3 text-sm outline-none focus:border-foreground/40 mb-4"
      />

      {error && <p className="text-sm text-rose-600 mb-3">{error}</p>}

      <button
        onClick={continueToBooking}
        disabled={loading || !enough}
        className="inline-flex items-center gap-2 rounded-lg bg-foreground text-background px-5 h-10 text-sm cursor-pointer hover:bg-foreground/90 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calendar className="h-4 w-4" />}
        {loading ? "Opening calendar…" : "Continue to booking"}
      </button>
    </div>
  );
}
