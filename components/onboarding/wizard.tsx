"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type Tri = "yes" | "no" | "prefer_not";
type Opt = "off" | "honest" | "aggressive";

type WizardData = {
  location: { address: string; city: string; postalCode: string; district: string; country: string; state: string };
  contact: { phone: string; linkedin: string; github: string; portfolio: string };
  workEligibility: { authorizedCountries: string[]; needsSponsorship: boolean; sponsorshipCountries: string[] };
  workPrefs: { arrangements: string[]; internshipOnly: boolean };
  comp: { salaryExpectation: string; salaryCurrency: string; salaryPeriod: string; noticePeriod: string; yearsExperience: string };
  checklist: {
    openToInPerson: boolean; willingToRelocate: boolean; canStartImmediately: boolean;
    reliableTransport: boolean; accommodations: Tri; govClearance: boolean; foreignGovTies: boolean;
    gender: string; raceEthnicity: string; veteran: Tri; disability: Tri; notes: string;
  };
  applicationPassword: string;
  applicationSettings: {
    resumeOptimization: Opt; resumeAutoApprove: boolean;
    coverLetterOptimization: Opt; coverLetterAutoApprove: boolean;
    allowEmbellishment: boolean;
  };
};

const initialData: WizardData = {
  location: { address: "", city: "", postalCode: "", district: "", country: "", state: "" },
  contact: { phone: "", linkedin: "", github: "", portfolio: "" },
  workEligibility: { authorizedCountries: [], needsSponsorship: false, sponsorshipCountries: [] },
  workPrefs: { arrangements: [], internshipOnly: false },
  comp: { salaryExpectation: "", salaryCurrency: "NGN", salaryPeriod: "year", noticePeriod: "", yearsExperience: "" },
  checklist: {
    openToInPerson: true, willingToRelocate: false, canStartImmediately: true, reliableTransport: true,
    accommodations: "prefer_not", govClearance: false, foreignGovTies: false,
    gender: "", raceEthnicity: "", veteran: "prefer_not", disability: "prefer_not", notes: "",
  },
  applicationPassword: "",
  applicationSettings: {
    resumeOptimization: "honest", resumeAutoApprove: false,
    coverLetterOptimization: "honest", coverLetterAutoApprove: false,
    allowEmbellishment: false,
  },
};

// Merge a saved (possibly partial / older-shape) draft over the defaults.
type SavedData = Partial<WizardData> & { _step?: number };
function withDefaults(saved?: SavedData | null): WizardData {
  if (!saved) return initialData;
  return {
    location: { ...initialData.location, ...(saved.location ?? {}) },
    contact: { ...initialData.contact, ...(saved.contact ?? {}) },
    workEligibility: { ...initialData.workEligibility, ...(saved.workEligibility ?? {}) },
    workPrefs: { ...initialData.workPrefs, ...(saved.workPrefs ?? {}) },
    comp: { ...initialData.comp, ...(saved.comp ?? {}) },
    checklist: { ...initialData.checklist, ...(saved.checklist ?? {}) },
    applicationPassword: "", // never restored from the server (stored encrypted)
    applicationSettings: { ...initialData.applicationSettings, ...(saved.applicationSettings ?? {}) },
  };
}

const STEPS = [
  { eyebrow: "Location", title: "Where do you live?" },
  { eyebrow: "Contact", title: "How should we reach out?" },
  { eyebrow: "Work eligibility", title: "Where can you work?" },
  { eyebrow: "Work preferences", title: "What kind of roles do you want?" },
  { eyebrow: "Quick checklist", title: "A few last questions." },
  { eyebrow: "Application password", title: "Set a password for sites that ask" },
  { eyebrow: "Application settings", title: "How should we apply?" },
  { eyebrow: "Telegram", title: "Search jobs from your chat" },
];

const ARRANGEMENTS: { v: string; label: string; desc: string }[] = [
  { v: "remote", label: "Remote", desc: "Work from anywhere" },
  { v: "hybrid", label: "Hybrid", desc: "Mix of home and office" },
  { v: "onsite", label: "Onsite", desc: "In the office" },
];

const COUNTRIES = [
  "Nigeria",
  "Other Africa",
  "United Kingdom",
  "European Union",
  "Canada",
  "United States",
  "Australia",
  "Asia",
  "South America",
  "Remote (anywhere)",
];
const SPONSOR_COUNTRIES = ["United Kingdom", "Canada", "European Union", "United States", "Australia"];

const PW_RULES: { label: string; test: (s: string) => boolean }[] = [
  { label: "At least 12 characters", test: (s) => s.length >= 12 },
  { label: "At least one lowercase letter", test: (s) => /[a-z]/.test(s) },
  { label: "At least one uppercase letter", test: (s) => /[A-Z]/.test(s) },
  { label: "At least one number", test: (s) => /[0-9]/.test(s) },
  { label: "At least one special character", test: (s) => /[^A-Za-z0-9]/.test(s) },
];

// ---- small controls ----
function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="font-mono text-xs tracking-widest text-muted-foreground uppercase mb-3">{children}</p>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="font-mono text-[11px] tracking-widest text-muted-foreground uppercase">{label}</span>
      {children}
    </div>
  );
}

function YesNo({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="inline-flex rounded-lg bg-foreground/5 p-1">
      {[true, false].map((v) => (
        <button
          key={String(v)}
          type="button"
          onClick={() => onChange(v)}
          className={`px-4 py-1.5 text-sm rounded-md transition-colors cursor-pointer ${
            value === v ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {v ? "Yes" : "No"}
        </button>
      ))}
    </div>
  );
}

function TriToggle({ value, onChange }: { value: Tri; onChange: (v: Tri) => void }) {
  const opts: { v: Tri; label: string }[] = [
    { v: "yes", label: "Yes" },
    { v: "no", label: "No" },
    { v: "prefer_not", label: "Prefer not" },
  ];
  return (
    <div className="inline-flex rounded-lg bg-foreground/5 p-1">
      {opts.map((o) => (
        <button
          key={o.v}
          type="button"
          onClick={() => onChange(o.v)}
          className={`px-3 py-1.5 text-sm rounded-md transition-colors cursor-pointer ${
            value === o.v ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border px-4 py-3 text-sm text-left transition-colors cursor-pointer ${
        active ? "border-foreground bg-foreground text-background" : "border-foreground/15 hover:border-foreground/40"
      }`}
    >
      {children}
    </button>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-4 border-b border-foreground/5 last:border-b-0">
      <div>
        <div className="text-sm">{label}</div>
        {hint && <div className="text-xs text-muted-foreground mt-0.5">{hint}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function OptionCard({
  active, title, desc, onClick,
}: { active: boolean; title: string; desc: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-start gap-3 px-5 py-4 text-left transition-colors cursor-pointer ${
        active ? "bg-foreground/[0.04]" : "hover:bg-foreground/[0.02]"
      }`}
    >
      <span className={`mt-1 w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${active ? "border-foreground" : "border-foreground/30"}`}>
        {active && <span className="w-2 h-2 rounded-full bg-foreground" />}
      </span>
      <span>
        <span className="block text-sm font-medium">{title}</span>
        <span className="block text-sm text-muted-foreground">{desc}</span>
      </span>
    </button>
  );
}

function FinishingOverlay() {
  const messages = [
    "Saving your answers",
    "Building your profile",
    "Matching you to jobs",
    "Getting your dashboard ready",
  ];
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((n) => Math.min(n + 1, messages.length - 1)), 900);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-background/95 backdrop-blur-sm">
      <Loader2 className="w-8 h-8 animate-spin" />
      <p className="font-display text-2xl tracking-tight">{messages[i]}</p>
      <p className="text-sm text-muted-foreground">This takes a few seconds.</p>
    </div>
  );
}

export function OnboardingWizard({
  initialParsed,
  saved,
  initialStep,
}: {
  initialParsed: boolean;
  saved?: SavedData | null;
  initialStep?: number;
}) {
  const router = useRouter();
  const [step, setStep] = useState(() => Math.min(Math.max(initialStep ?? 0, 0), STEPS.length - 1));
  const [data, setData] = useState<WizardData>(() => withDefaults(saved));
  const [parsed, setParsed] = useState(initialParsed);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");

  const set = useCallback(<K extends keyof WizardData>(key: K, value: WizardData[K]) => {
    setData((d) => ({ ...d, [key]: value }));
  }, []);

  // Poll parse status until done.
  useEffect(() => {
    if (parsed) return;
    const id = setInterval(async () => {
      try {
        const res = await fetch("/api/onboarding/status");
        if (res.ok) {
          const { parsed: done } = await res.json();
          if (done) {
            setParsed(true);
            clearInterval(id);
          }
        }
      } catch {
        /* ignore */
      }
    }, 4000);
    return () => clearInterval(id);
  }, [parsed]);

  const save = useCallback(
    async (finalize: boolean) => {
      const res = await fetch("/api/onboarding/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // _step is persisted so a refresh resumes on the same step.
        body: JSON.stringify({ ...data, _step: step, finalize }),
      });
      if (res.ok) setSavedAt(Date.now());
      return res.ok;
    },
    [data, step],
  );

  // Debounced autosave so progress survives a refresh even without clicking Continue.
  const didMount = useRef(false);
  useEffect(() => {
    if (!didMount.current) {
      didMount.current = true;
      return;
    }
    const t = setTimeout(() => {
      void save(false);
    }, 1200);
    return () => clearTimeout(t);
  }, [data, step, save]);

  const isLast = step === STEPS.length - 1;

  const next = async () => {
    if (isLast) {
      setError("");
      setFinishing(true);
      const start = Date.now();
      const ok = await save(true);
      if (!ok) {
        setFinishing(false);
        setError("Could not finish setup. Please try again.");
        return;
      }
      // Keep the overlay up for a moment so the status messages register.
      const elapsed = Date.now() - start;
      if (elapsed < 2600) await new Promise((r) => setTimeout(r, 2600 - elapsed));
      router.push("/dashboard");
      router.refresh();
      return;
    }
    setSubmitting(true);
    try {
      await save(false); // autosave
      setStep((s) => Math.min(s + 1, STEPS.length - 1));
    } finally {
      setSubmitting(false);
    }
  };

  const back = () => setStep((s) => Math.max(s - 1, 0));

  const toggleIn = (arr: string[], v: string) =>
    arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];

  const generatePassword = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%^&*";
    let out = "";
    const arr = new Uint32Array(16);
    crypto.getRandomValues(arr);
    for (const n of arr) out += chars[n % chars.length];
    set("applicationPassword", out);
    setShowPw(true);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const tag = (e.target as HTMLElement).tagName;
    if (e.key === "Enter" && tag !== "TEXTAREA" && !submitting) {
      e.preventDefault();
      next();
    }
  };

  const progress = ((step + 1) / STEPS.length) * 100;

  return (
    <>
      {finishing && <FinishingOverlay />}
      <div className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-5xl rounded-2xl border border-foreground/10 bg-background shadow-sm overflow-hidden" onKeyDown={onKeyDown}>
        {/* top bar */}
        <div className="px-6 lg:px-8 pt-5 pb-0">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Step {step + 1} of {STEPS.length}</span>
            {step > 0 && (
              <button type="button" onClick={back} className="text-muted-foreground hover:text-foreground cursor-pointer">
                ← Back
              </button>
            )}
          </div>
          <div className="mt-3 h-1 rounded-full bg-foreground/10 overflow-hidden">
            <div className="h-full bg-foreground transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
        </div>

        <div className="grid md:grid-cols-[260px_1fr]">
          {/* sidebar */}
          <aside className="p-6 lg:p-8 border-b md:border-b-0 md:border-r border-foreground/10">
            <div className="flex items-center justify-between mb-3">
              <span className="font-mono text-xs tracking-widest text-muted-foreground uppercase">Resume</span>
              <span className="inline-flex items-center gap-2 text-xs">
                <span className={`w-2 h-2 rounded-full ${parsed ? "bg-green-500" : "bg-green-500 animate-pulse"}`} />
                {parsed ? "done" : "in progress"}
              </span>
            </div>
            <div className="h-1 rounded-full bg-foreground/10 overflow-hidden mb-3">
              <div className={`h-full bg-foreground ${parsed ? "w-full" : "w-1/2 animate-pulse"}`} />
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {parsed
                ? "Parsed. While you finish setup, we're matching jobs for you."
                : "Takes 30 to 60 seconds. We're pulling your work history and skills while you finish these."}
            </p>

            <h3 className="text-sm font-medium mt-8 mb-2">Why we ask</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Every application asks these. Answer once here, we fill the forms.
            </p>

            <div className="hidden md:block mt-10 pt-6 border-t border-foreground/10 space-y-2 text-xs text-muted-foreground">
              <div><kbd className="font-mono">Enter</kbd> Continue</div>
            </div>
          </aside>

          {/* content */}
          <section className="p-6 lg:p-12">
            <Eyebrow>{STEPS[step].eyebrow}</Eyebrow>
            <h1 className="font-display text-3xl lg:text-4xl tracking-tight mb-3">{STEPS[step].title}</h1>

            {/* STEP 1 — Location */}
            {step === 0 && (
              <div className="max-w-2xl">
                <p className="text-muted-foreground mb-8">
                  Most job sites need a full address. We'll fill it in automatically from here.
                </p>
                <div className="flex flex-col gap-6">
                  <Field label="Address">
                    <Input value={data.location.address} placeholder="Start typing your address"
                      onChange={(e) => set("location", { ...data.location, address: e.target.value })} />
                  </Field>
                  <div className="grid sm:grid-cols-2 gap-6">
                    <Field label="City">
                      <Input value={data.location.city} placeholder="Lagos"
                        onChange={(e) => set("location", { ...data.location, city: e.target.value })} />
                    </Field>
                    <Field label="Postal code">
                      <Input value={data.location.postalCode} placeholder="100001"
                        onChange={(e) => set("location", { ...data.location, postalCode: e.target.value })} />
                    </Field>
                  </div>
                  <Field label="State / region">
                    <Input value={data.location.state} placeholder="Lagos State"
                      onChange={(e) => set("location", { ...data.location, state: e.target.value })} />
                  </Field>
                  <Field label="Country">
                    <Input value={data.location.country} placeholder="Nigeria"
                      onChange={(e) => set("location", { ...data.location, country: e.target.value })} />
                  </Field>
                </div>
              </div>
            )}

            {/* STEP 2 — Contact */}
            {step === 1 && (
              <div className="max-w-2xl">
                <p className="text-muted-foreground mb-8">
                  Phone and LinkedIn show up on most applications. Skip and we'll use whatever the CV parser finds.
                </p>
                <div className="flex flex-col gap-6">
                  <Field label="Phone">
                    <Input value={data.contact.phone} placeholder="Start with + and your country code, e.g. +234..."
                      onChange={(e) => set("contact", { ...data.contact, phone: e.target.value })} />
                  </Field>
                  <Field label="LinkedIn">
                    <Input value={data.contact.linkedin} placeholder="https://linkedin.com/in/yourhandle"
                      onChange={(e) => set("contact", { ...data.contact, linkedin: e.target.value })} />
                  </Field>
                  <Field label="GitHub · optional">
                    <Input value={data.contact.github} placeholder="https://github.com/yourhandle"
                      onChange={(e) => set("contact", { ...data.contact, github: e.target.value })} />
                  </Field>
                  <Field label="Portfolio · optional">
                    <Input value={data.contact.portfolio} placeholder="https://yourname.com"
                      onChange={(e) => set("contact", { ...data.contact, portfolio: e.target.value })} />
                  </Field>
                  <p className="text-xs text-muted-foreground">Asked on basically every Greenhouse, Lever, and Ashby application. GitHub and portfolio help for engineering and design roles.</p>
                </div>
              </div>
            )}

            {/* STEP 3 — Work eligibility (localized) */}
            {step === 2 && (
              <div className="max-w-3xl">
                <p className="text-muted-foreground mb-8">
                  We use this to filter out jobs you can't apply to, and to find roles that will sponsor you.
                </p>
                <p className="font-mono text-[11px] tracking-widest text-muted-foreground uppercase mb-3">
                  Where can you work without sponsorship?
                </p>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-8">
                  {COUNTRIES.map((c) => (
                    <Chip key={c} active={data.workEligibility.authorizedCountries.includes(c)}
                      onClick={() => set("workEligibility", { ...data.workEligibility, authorizedCountries: toggleIn(data.workEligibility.authorizedCountries, c) })}>
                      {c}
                    </Chip>
                  ))}
                </div>

                <div className="flex items-center justify-between gap-4 py-4 border-t border-foreground/10">
                  <span className="text-sm">Do you need visa sponsorship?</span>
                  <YesNo value={data.workEligibility.needsSponsorship}
                    onChange={(v) => set("workEligibility", { ...data.workEligibility, needsSponsorship: v })} />
                </div>

                {data.workEligibility.needsSponsorship && (
                  <>
                    <p className="font-mono text-[11px] tracking-widest text-muted-foreground uppercase mb-3 mt-4">
                      Which countries do you want sponsorship for?
                    </p>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {SPONSOR_COUNTRIES.map((c) => (
                        <Chip key={c} active={data.workEligibility.sponsorshipCountries.includes(c)}
                          onClick={() => set("workEligibility", { ...data.workEligibility, sponsorshipCountries: toggleIn(data.workEligibility.sponsorshipCountries, c) })}>
                          {c}
                        </Chip>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* STEP 4 — Work preferences */}
            {step === 3 && (
              <div className="max-w-3xl">
                <p className="text-muted-foreground mb-8">
                  This shapes what the agent looks for. Pick everything that fits, or skip to see all roles.
                </p>

                <p className="font-mono text-[11px] tracking-widest text-muted-foreground uppercase mb-3">
                  Work arrangement
                </p>
                <div className="grid sm:grid-cols-3 gap-3 mb-8">
                  {ARRANGEMENTS.map((a) => (
                    <Chip
                      key={a.v}
                      active={data.workPrefs.arrangements.includes(a.v)}
                      onClick={() => set("workPrefs", { ...data.workPrefs, arrangements: toggleIn(data.workPrefs.arrangements, a.v) })}
                    >
                      <span className="block font-medium">{a.label}</span>
                      <span className="block text-xs opacity-70">{a.desc}</span>
                    </Chip>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mb-8">Leave all unselected to include every arrangement.</p>

                <p className="font-mono text-[11px] tracking-widest text-muted-foreground uppercase mb-3">
                  Employment type
                </p>
                <div className="grid sm:grid-cols-2 gap-3">
                  <Chip
                    active={!data.workPrefs.internshipOnly}
                    onClick={() => set("workPrefs", { ...data.workPrefs, internshipOnly: false })}
                  >
                    <span className="block font-medium">Open to all roles</span>
                    <span className="block text-xs opacity-70">Full time, contract, and internships</span>
                  </Chip>
                  <Chip
                    active={data.workPrefs.internshipOnly}
                    onClick={() => set("workPrefs", { ...data.workPrefs, internshipOnly: true })}
                  >
                    <span className="block font-medium">Internships only</span>
                    <span className="block text-xs opacity-70">Great if you are after experience</span>
                  </Chip>
                </div>
                {data.workPrefs.internshipOnly && (
                  <p className="text-sm text-muted-foreground mt-4 rounded-lg bg-foreground/[0.03] p-4">
                    The agent will only find and apply to internships for you, on the dashboard and in Telegram.
                  </p>
                )}
              </div>
            )}

            {/* STEP 5 — Quick checklist */}
            {step === 4 && (
              <div className="max-w-3xl">
                <p className="text-muted-foreground mb-8">
                  Tap through. Defaults work for most people, only change what applies.
                </p>
                <div className="rounded-xl border border-foreground/10 overflow-hidden mb-6">
                  <div className="bg-foreground/[0.03] px-5 py-2 font-mono text-[11px] tracking-widest text-muted-foreground uppercase">Compensation and availability</div>
                  <div className="px-5 py-4 flex flex-col gap-5">
                    <div className="grid sm:grid-cols-2 gap-5">
                      <Field label="Expected salary">
                        <Input value={data.comp.salaryExpectation} placeholder="e.g. 90,000 or Negotiable"
                          onChange={(e) => set("comp", { ...data.comp, salaryExpectation: e.target.value })} />
                      </Field>
                      <Field label="Currency">
                        <div className="inline-flex rounded-lg bg-foreground/5 p-1">
                          {["NGN", "USD", "GBP", "EUR"].map((c) => (
                            <button key={c} type="button" onClick={() => set("comp", { ...data.comp, salaryCurrency: c })}
                              className={`px-3 py-1.5 text-sm rounded-md transition-colors cursor-pointer ${data.comp.salaryCurrency === c ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}>
                              {c}
                            </button>
                          ))}
                        </div>
                      </Field>
                    </div>
                    <Field label="Per">
                      <div className="inline-flex rounded-lg bg-foreground/5 p-1">
                        {["year", "month", "hour"].map((p) => (
                          <button key={p} type="button" onClick={() => set("comp", { ...data.comp, salaryPeriod: p })}
                            className={`px-3 py-1.5 text-sm rounded-md transition-colors cursor-pointer capitalize ${data.comp.salaryPeriod === p ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}>
                            {p}
                          </button>
                        ))}
                      </div>
                    </Field>
                    <Field label="Notice period">
                      <div className="flex flex-wrap gap-2">
                        {["Immediately", "1 week", "2 weeks", "1 month", "2 months", "3 months"].map((n) => (
                          <button key={n} type="button" onClick={() => set("comp", { ...data.comp, noticePeriod: n })}
                            className={`rounded-lg border px-3 py-2 text-sm transition-colors cursor-pointer ${data.comp.noticePeriod === n ? "border-foreground bg-foreground text-background" : "border-foreground/15 hover:border-foreground/40"}`}>
                            {n}
                          </button>
                        ))}
                      </div>
                    </Field>
                    <Field label="Years of experience">
                      <Input value={data.comp.yearsExperience} placeholder="e.g. 5"
                        onChange={(e) => set("comp", { ...data.comp, yearsExperience: e.target.value })} />
                    </Field>
                  </div>
                </div>
                <div className="rounded-xl border border-foreground/10 overflow-hidden">
                  <div className="bg-foreground/[0.03] px-5 py-2 font-mono text-[11px] tracking-widest text-muted-foreground uppercase">Preferences</div>
                  <div className="px-5">
                    <Row label="Open to in-person work?"><YesNo value={data.checklist.openToInPerson} onChange={(v) => set("checklist", { ...data.checklist, openToInPerson: v })} /></Row>
                    <Row label="Willing to relocate?"><YesNo value={data.checklist.willingToRelocate} onChange={(v) => set("checklist", { ...data.checklist, willingToRelocate: v })} /></Row>
                    <Row label="Can start immediately?"><YesNo value={data.checklist.canStartImmediately} onChange={(v) => set("checklist", { ...data.checklist, canStartImmediately: v })} /></Row>
                    <Row label="Reliable transportation?"><YesNo value={data.checklist.reliableTransport} onChange={(v) => set("checklist", { ...data.checklist, reliableTransport: v })} /></Row>
                    <Row label="Need workplace accommodations?" hint="Disability, religious, or other."><TriToggle value={data.checklist.accommodations} onChange={(v) => set("checklist", { ...data.checklist, accommodations: v })} /></Row>
                  </div>
                  <div className="bg-foreground/[0.03] px-5 py-2 font-mono text-[11px] tracking-widest text-muted-foreground uppercase">Background</div>
                  <div className="px-5">
                    <Row label="Active government clearance?"><YesNo value={data.checklist.govClearance} onChange={(v) => set("checklist", { ...data.checklist, govClearance: v })} /></Row>
                    <Row label="Family ties to foreign governments?" hint="Some employers are required to ask."><YesNo value={data.checklist.foreignGovTies} onChange={(v) => set("checklist", { ...data.checklist, foreignGovTies: v })} /></Row>
                  </div>
                  <div className="bg-foreground/[0.03] px-5 py-2 font-mono text-[11px] tracking-widest text-muted-foreground uppercase">Diversity and inclusion (optional)</div>
                  <div className="px-5">
                    <Row label="Veteran status"><TriToggle value={data.checklist.veteran} onChange={(v) => set("checklist", { ...data.checklist, veteran: v })} /></Row>
                    <Row label="Disability status" hint="Employers report this in aggregate."><TriToggle value={data.checklist.disability} onChange={(v) => set("checklist", { ...data.checklist, disability: v })} /></Row>
                  </div>
                  <div className="bg-foreground/[0.03] px-5 py-2 font-mono text-[11px] tracking-widest text-muted-foreground uppercase">Additional info (optional)</div>
                  <div className="px-5 py-4">
                    <div className="text-sm mb-1">Anything else we should know when filling applications?</div>
                    <div className="text-xs text-muted-foreground mb-3">e.g. "Notice period 15 days", "Willing to travel up to 50%"</div>
                    <Textarea rows={3} value={data.checklist.notes} placeholder="Optional notes"
                      onChange={(e) => set("checklist", { ...data.checklist, notes: e.target.value })} />
                  </div>
                </div>
              </div>
            )}

            {/* STEP 6 — Application password */}
            {step === 5 && (
              <div className="max-w-2xl">
                <p className="text-muted-foreground mb-6">
                  Some applications (Workday, iCIMS, Oracle) make you create an account mid-flow. We use this to sign you up automatically.
                </p>
                <div className="rounded-xl border border-foreground/10 overflow-hidden">
                  <div className="flex items-center justify-between bg-foreground/[0.03] px-5 py-3">
                    <span className="font-mono text-[11px] tracking-widest text-muted-foreground uppercase">Password</span>
                    <button type="button" onClick={generatePassword} className="text-sm underline underline-offset-4 cursor-pointer">Generate strong password</button>
                  </div>
                  <div className="px-5 py-5">
                    <div className="flex items-center gap-2 border-b border-foreground/15 pb-2">
                      <input
                        type={showPw ? "text" : "password"}
                        value={data.applicationPassword}
                        onChange={(e) => set("applicationPassword", e.target.value)}
                        placeholder="Enter your application password"
                        className="flex-1 bg-transparent outline-none text-sm py-1"
                      />
                      <button type="button" onClick={() => setShowPw((s) => !s)} className="text-muted-foreground hover:text-foreground cursor-pointer text-xs">
                        {showPw ? "Hide" : "Show"}
                      </button>
                    </div>
                    <ul className="mt-4 space-y-2">
                      {PW_RULES.map((r) => {
                        const ok = r.test(data.applicationPassword);
                        return (
                          <li key={r.label} className="flex items-center gap-2 text-sm">
                            <span className={`w-4 h-4 rounded-full border flex items-center justify-center text-[10px] ${ok ? "border-green-500 text-green-600" : "border-foreground/25 text-transparent"}`}>✓</span>
                            <span className={ok ? "text-foreground" : "text-muted-foreground"}>{r.label}</span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-4 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-500" /> Encrypted before we save it.
                </p>
              </div>
            )}

            {/* STEP 7 — Application settings */}
            {step === 6 && (
              <div className="max-w-3xl">
                <p className="text-muted-foreground mb-8">You can change these anytime from settings.</p>
                <div className="rounded-xl border border-foreground/10 overflow-hidden mb-6">
                  <div className="bg-foreground/[0.03] px-5 py-2 font-mono text-[11px] tracking-widest text-muted-foreground uppercase">CV optimization</div>
                  <OptionCard active={data.applicationSettings.resumeOptimization === "off"} title="Off" desc="Send your CV exactly as uploaded." onClick={() => set("applicationSettings", { ...data.applicationSettings, resumeOptimization: "off" })} />
                  <OptionCard active={data.applicationSettings.resumeOptimization === "honest"} title="Honest" desc="Reorder and emphasize experience that's relevant to each job." onClick={() => set("applicationSettings", { ...data.applicationSettings, resumeOptimization: "honest" })} />
                  <OptionCard active={data.applicationSettings.resumeOptimization === "aggressive"} title="Aggressive" desc="Maximize keyword alignment to each job. Still only your true facts." onClick={() => set("applicationSettings", { ...data.applicationSettings, resumeOptimization: "aggressive" })} />
                  <div className="px-5"><Row label="Auto approve edits?" hint="Skip the preview step and send optimized files straight through."><YesNo value={data.applicationSettings.resumeAutoApprove} onChange={(v) => set("applicationSettings", { ...data.applicationSettings, resumeAutoApprove: v })} /></Row></div>
                </div>
                <div className="rounded-xl border border-foreground/10 overflow-hidden">
                  <div className="bg-foreground/[0.03] px-5 py-2 font-mono text-[11px] tracking-widest text-muted-foreground uppercase">Cover letter optimization</div>
                  <OptionCard active={data.applicationSettings.coverLetterOptimization === "off"} title="Off" desc="Don't generate a cover letter." onClick={() => set("applicationSettings", { ...data.applicationSettings, coverLetterOptimization: "off" })} />
                  <OptionCard active={data.applicationSettings.coverLetterOptimization === "honest"} title="Honest" desc="Tailor tone and emphasis to each job, no fabrication." onClick={() => set("applicationSettings", { ...data.applicationSettings, coverLetterOptimization: "honest" })} />
                  <OptionCard active={data.applicationSettings.coverLetterOptimization === "aggressive"} title="Aggressive" desc="Lean hard into the job description's language. Still only your true facts." onClick={() => set("applicationSettings", { ...data.applicationSettings, coverLetterOptimization: "aggressive" })} />
                  <div className="px-5"><Row label="Auto approve edits?" hint="Skip the preview step and send the cover letter straight through."><YesNo value={data.applicationSettings.coverLetterAutoApprove} onChange={(v) => set("applicationSettings", { ...data.applicationSettings, coverLetterAutoApprove: v })} /></Row></div>
                </div>

                <div className="rounded-xl border border-foreground/10 overflow-hidden mt-6">
                  <div className="bg-foreground/[0.03] px-5 py-2 font-mono text-[11px] tracking-widest text-muted-foreground uppercase">Honesty</div>
                  <div className="px-5 py-4">
                    <Row
                      label="Let the agent add skills you have not listed?"
                      hint="Off by default. When off, the agent only uses your true facts and a fact checker blocks anything it cannot verify."
                    >
                      <YesNo
                        value={data.applicationSettings.allowEmbellishment}
                        onChange={(v) => set("applicationSettings", { ...data.applicationSettings, allowEmbellishment: v })}
                      />
                    </Row>
                    <div className="mt-3 rounded-lg bg-foreground/[0.03] p-4 text-sm text-muted-foreground">
                      <p className="mb-2">
                        Example: a role asks for WebRTC and it is not in your profile. With this off, the agent will not
                        claim it. With this on, the agent may add job relevant skills like WebRTC to your experience even
                        if you did not list them, to better match the role.
                      </p>
                      <p>
                        Turn this on only if you understand the risk. Claims you cannot back up in an interview can cost you
                        the offer. You stay responsible for what you submit.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 8 — Telegram info */}
            {step === 7 && (
              <div className="max-w-2xl">
                <p className="text-muted-foreground mb-8">
                  Sasa has a Telegram bot so you can search and apply to jobs right from your chat. It is optional, and
                  you turn it on after setup.
                </p>

                <div className="rounded-xl border border-foreground/10 overflow-hidden mb-6">
                  <div className="bg-foreground/[0.03] px-5 py-2 font-mono text-[11px] tracking-widest text-muted-foreground uppercase">
                    How to turn it on
                  </div>
                  <ol className="px-5 py-4 space-y-3 text-sm">
                    <li className="flex gap-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-foreground text-background text-xs">1</span>
                      <span>Finish setup, then open <span className="font-medium">Settings</span> in your dashboard.</span>
                    </li>
                    <li className="flex gap-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-foreground text-background text-xs">2</span>
                      <span>Under <span className="font-medium">Telegram</span>, tap Connect. It opens the bot and links your account.</span>
                    </li>
                    <li className="flex gap-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-foreground text-background text-xs">3</span>
                      <span>Send the bot a message telling it what you want.</span>
                    </li>
                  </ol>
                </div>

                <div className="rounded-xl border border-foreground/10 overflow-hidden">
                  <div className="bg-foreground/[0.03] px-5 py-2 font-mono text-[11px] tracking-widest text-muted-foreground uppercase">
                    What you can type
                  </div>
                  <div className="px-5 py-4 flex flex-col gap-2 text-sm">
                    {[
                      "remote backend roles",
                      "visa sponsorship jobs in Europe",
                      "product internships in Lagos",
                      "senior data roles",
                    ].map((ex) => (
                      <span key={ex} className="rounded-lg bg-foreground/[0.04] px-3 py-2 font-mono text-xs">“{ex}”</span>
                    ))}
                    <p className="text-muted-foreground mt-2">
                      The agent replies with your best matches and their fit percentage, each with a button to tailor
                      your CV and apply. It only messages you when you ask, or when an application you approved is ready.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* footer */}
            <div className="mt-10 flex items-center gap-4">
              <Button onClick={next} disabled={submitting || finishing} className="h-12 px-7 rounded-lg bg-foreground text-background hover:bg-foreground/90 cursor-pointer">
                {submitting ? "Saving…" : isLast ? "Finish setup" : "Continue"}
              </Button>
              {savedAt && (
                <span className="text-sm text-muted-foreground flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-500" /> Autosaved
                </span>
              )}
              {error && <span className="text-sm text-red-600">{error}</span>}
            </div>
          </section>
        </div>
      </div>
    </div>
    </>
  );
}
