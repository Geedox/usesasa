import Link from "next/link";
import {
  MapPin,
  Pencil,
  Linkedin,
  Github,
  Globe,
  Mail,
  Phone,
  FileText,
  Upload,
  Download,
  Eye,
} from "lucide-react";
import type { Profile } from "@/lib/profile";
import { ProfileToc } from "@/components/profile/profile-toc";
import { CustomSections } from "@/components/profile/custom-sections";

function completeness(p: Profile): number {
  const checks = [
    !!p.full_name,
    !!p.email,
    !!p.phone,
    !!p.summary,
    !!(p.location.city || p.location.country),
    !!(p.links.linkedin || p.links.github || p.links.portfolio),
    p.experience.length > 0,
    p.education.length > 0,
    p.skills.length > 0,
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

function Ring({ value }: { value: number }) {
  const r = 22;
  const c = 2 * Math.PI * r;
  const dash = (value / 100) * c;
  return (
    <div className="relative w-14 h-14 shrink-0">
      <svg viewBox="0 0 56 56" className="w-14 h-14 -rotate-90">
        <circle cx="28" cy="28" r={r} fill="none" strokeWidth="4" stroke="currentColor" className="text-foreground/10" />
        <circle cx="28" cy="28" r={r} fill="none" strokeWidth="4" strokeLinecap="round" stroke="#f59e0b" strokeDasharray={`${dash} ${c}`} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xs font-semibold leading-none">{value}%</span>
        <span className="font-mono text-[6px] tracking-widest text-muted-foreground uppercase mt-0.5">done</span>
      </div>
    </div>
  );
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

function SectionCard({ id, title, icon, count, editHref, children }: {
  id: string; title: string; icon: React.ReactNode; count?: string; editHref?: string; children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-6 rounded-xl border border-foreground/10 bg-background p-6">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2.5">
          <span className="text-muted-foreground">{icon}</span>
          <h2 className="font-display text-xl tracking-tight">{title}</h2>
          {count && <span className="text-xs text-muted-foreground">{count}</span>}
        </div>
        {editHref && (
          <Link href={editHref} className="inline-flex items-center gap-1.5 rounded-lg border border-foreground/15 px-3 py-1.5 text-sm hover:border-foreground/40">
            <Pencil className="w-3.5 h-3.5" /> Edit
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

function Chip({ children, on }: { children: React.ReactNode; on?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-sm ${on === false ? "bg-foreground/[0.04] text-muted-foreground" : "bg-foreground/[0.05]"}`}>
      {children}
    </span>
  );
}

type Onboarding = {
  workEligibility?: { authorizedCountries?: string[]; needsSponsorship?: boolean; sponsorshipCountries?: string[] };
  checklist?: Record<string, unknown>;
} | null;

const EDIT = "/dashboard/profile/edit";

export function ProfileView({ profile, onboarding, resumeUrl }: { profile: Profile; onboarding: Onboarding; resumeUrl: string | null }) {
  const pct = completeness(profile);
  const elig = onboarding?.workEligibility;
  const cl = (onboarding?.checklist ?? {}) as Record<string, unknown>;
  const yesno = (v: unknown) => (v === true ? "Yes" : v === false ? "No" : "—");

  return (
    <div className="max-w-5xl mx-auto px-6 lg:px-10 py-8">
      <div className="grid lg:grid-cols-[1fr_180px] gap-8">
        {/* Main column */}
        <div className="flex flex-col gap-5 min-w-0">
          {/* Header */}
          <section id="profile" className="scroll-mt-6 rounded-xl border border-foreground/10 bg-background p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-4 min-w-0">
                <div className="w-12 h-12 rounded-full bg-foreground text-background flex items-center justify-center font-display text-lg shrink-0">
                  {initials(profile.full_name || "?")}
                </div>
                <div className="min-w-0">
                  <h1 className="font-display text-2xl tracking-tight">{profile.full_name || "Your name"}</h1>
                  <p className="text-sm text-muted-foreground mt-1 mb-2">
                    {profile.summary || "Add a short summary about yourself."}
                  </p>
                  {(profile.location.city || profile.location.country) && (
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-3">
                      <MapPin className="w-3.5 h-3.5" />
                      {[profile.location.city, profile.location.country].filter(Boolean).join(", ")}
                    </div>
                  )}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    {profile.email && <span className="inline-flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" />{profile.email}</span>}
                    {profile.phone && <span className="inline-flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" />{profile.phone}</span>}
                  </div>
                  <div className="flex flex-wrap gap-2 mt-3">
                    {profile.links.linkedin && <a href={profile.links.linkedin} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-md bg-foreground/[0.05] px-2.5 py-1 text-sm hover:bg-foreground/[0.08]"><Linkedin className="w-3.5 h-3.5" />LinkedIn</a>}
                    {profile.links.github && <a href={profile.links.github} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-md bg-foreground/[0.05] px-2.5 py-1 text-sm hover:bg-foreground/[0.08]"><Github className="w-3.5 h-3.5" />GitHub</a>}
                    {profile.links.portfolio && <a href={profile.links.portfolio} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-md bg-foreground/[0.05] px-2.5 py-1 text-sm hover:bg-foreground/[0.08]"><Globe className="w-3.5 h-3.5" />Portfolio</a>}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <Ring value={pct} />
                <Link href={EDIT} className="inline-flex items-center gap-1.5 rounded-lg border border-foreground/15 px-3 py-1.5 text-sm hover:border-foreground/40">
                  <Pencil className="w-3.5 h-3.5" /> Edit
                </Link>
              </div>
            </div>
          </section>

          {/* Documents */}
          <div id="documents" className="scroll-mt-6 grid sm:grid-cols-2 gap-5">
            <div className="rounded-xl border border-foreground/10 bg-background p-5">
              <div className="flex items-center gap-2 mb-1"><FileText className="w-4 h-4 text-muted-foreground" /><span className="font-medium">Resume</span></div>
              <p className="text-sm text-muted-foreground mb-4">What we submit on every application.</p>
              <div className="flex flex-wrap gap-2">
                {resumeUrl ? (
                  <>
                    <a href={resumeUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg bg-foreground text-background px-3 py-1.5 text-sm"><Eye className="w-3.5 h-3.5" /> Preview</a>
                    <a href={resumeUrl} download className="inline-flex items-center gap-1.5 rounded-lg border border-foreground/15 px-3 py-1.5 text-sm"><Download className="w-3.5 h-3.5" /> Download</a>
                  </>
                ) : (
                  <span className="text-sm text-muted-foreground">No resume on file.</span>
                )}
                <Link href="/onboarding" className="inline-flex items-center gap-1.5 rounded-lg border border-foreground/15 px-3 py-1.5 text-sm"><Upload className="w-3.5 h-3.5" /> Upload</Link>
              </div>
            </div>
            <div className="rounded-xl border border-foreground/10 bg-background p-5">
              <div className="flex items-center gap-2 mb-1"><FileText className="w-4 h-4 text-muted-foreground" /><span className="font-medium">Cover letter</span></div>
              <p className="text-sm text-muted-foreground mb-4">We write one per role from your real experience.</p>
              <span className="text-sm text-muted-foreground">Generated when you apply.</span>
            </div>
          </div>

          {/* Experience */}
          <SectionCard id="experience" title="Experience" icon={<FileText className="w-4 h-4" />} count={`${profile.experience.length} roles`} editHref={EDIT}>
            {profile.experience.length === 0 ? (
              <p className="text-sm text-muted-foreground">No experience yet.</p>
            ) : (
              <div className="flex flex-col gap-6">
                {profile.experience.map((e, i) => (
                  <div key={i} className="flex gap-4">
                    <div className="w-9 h-9 rounded-md bg-foreground/[0.06] flex items-center justify-center text-xs font-medium shrink-0">{initials(e.company || e.title || "?")}</div>
                    <div className="min-w-0">
                      <div className="font-medium">{e.title || "Role"}</div>
                      <div className="text-sm text-muted-foreground">{e.company}{e.location ? ` · ${e.location}` : ""}</div>
                      {(e.start || e.end) && <div className="text-xs text-muted-foreground mt-0.5">{[e.start, e.end].filter(Boolean).join(" – ")}</div>}
                      {e.bullets.length > 0 && (
                        <ul className="mt-2 space-y-1">
                          {e.bullets.slice(0, 3).map((b, bi) => (
                            <li key={bi} className="text-sm text-muted-foreground flex gap-2"><span className="text-foreground/30">•</span><span>{b}</span></li>
                          ))}
                          {e.bullets.length > 3 && <li className="text-xs text-muted-foreground">+{e.bullets.length - 3} more</li>}
                        </ul>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          {/* Education */}
          <SectionCard id="education" title="Education" icon={<FileText className="w-4 h-4" />} count={`${profile.education.length} entries`} editHref={EDIT}>
            {profile.education.length === 0 ? (
              <p className="text-sm text-muted-foreground">No education yet.</p>
            ) : (
              <div className="flex flex-col gap-4">
                {profile.education.map((ed, i) => (
                  <div key={i}>
                    <div className="font-medium">{ed.institution}</div>
                    <div className="text-sm text-muted-foreground">{[ed.degree, ed.field].filter(Boolean).join(" · ")}</div>
                    {(ed.start || ed.end) && <div className="text-xs text-muted-foreground mt-0.5">{[ed.start, ed.end].filter(Boolean).join(" – ")}</div>}
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          {/* Skills */}
          <SectionCard id="skills" title="Skills" icon={<FileText className="w-4 h-4" />} count={`${profile.skills.length} skills`} editHref={EDIT}>
            {profile.skills.length === 0 ? (
              <p className="text-sm text-muted-foreground">No skills yet.</p>
            ) : (
              <div className="flex flex-wrap gap-2">{profile.skills.map((s, i) => <Chip key={i}>{s}</Chip>)}</div>
            )}
          </SectionCard>

          {/* Certifications */}
          <SectionCard id="certifications" title="Certifications" icon={<FileText className="w-4 h-4" />} editHref={EDIT}>
            {profile.certifications.length === 0 ? (
              <p className="text-sm text-muted-foreground">Add credentials, badges, or licenses.</p>
            ) : (
              <div className="flex flex-wrap gap-2">{profile.certifications.map((s, i) => <Chip key={i}>{s}</Chip>)}</div>
            )}
          </SectionCard>

          {/* Languages */}
          <SectionCard id="languages" title="Languages" icon={<FileText className="w-4 h-4" />} editHref={EDIT}>
            {profile.languages.length === 0 ? (
              <p className="text-sm text-muted-foreground">No languages yet.</p>
            ) : (
              <div className="flex flex-wrap gap-2">{profile.languages.map((l, i) => <Chip key={i}>{l.language}{l.proficiency ? ` · ${l.proficiency}` : ""}</Chip>)}</div>
            )}
          </SectionCard>

          {/* Application defaults */}
          <SectionCard id="application-defaults" title="Application defaults" icon={<FileText className="w-4 h-4" />} editHref="/onboarding">
            <p className="text-sm text-muted-foreground mb-5">What we auto-fill on every application form.</p>
            <div className="flex flex-col gap-5">
              <div>
                <p className="font-mono text-[11px] tracking-widest text-muted-foreground uppercase mb-2">Work authorization</p>
                <div className="flex flex-wrap gap-2">
                  {(elig?.authorizedCountries ?? []).map((c) => <Chip key={c}>{c}</Chip>)}
                  <Chip on={!!elig?.needsSponsorship}>Needs sponsorship: {yesno(elig?.needsSponsorship)}</Chip>
                  {(elig?.sponsorshipCountries ?? []).map((c) => <Chip key={`s-${c}`}>Sponsor: {c}</Chip>)}
                </div>
              </div>
              <div>
                <p className="font-mono text-[11px] tracking-widest text-muted-foreground uppercase mb-2">Work preferences</p>
                <div className="flex flex-wrap gap-2">
                  <Chip on={cl.openToInPerson !== false}>In-person: {yesno(cl.openToInPerson)}</Chip>
                  <Chip on={cl.willingToRelocate === true}>Relocate: {yesno(cl.willingToRelocate)}</Chip>
                  <Chip on={cl.canStartImmediately !== false}>Start now: {yesno(cl.canStartImmediately)}</Chip>
                  <Chip on={cl.reliableTransport !== false}>Transport: {yesno(cl.reliableTransport)}</Chip>
                </div>
              </div>
              <div>
                <p className="font-mono text-[11px] tracking-widest text-muted-foreground uppercase mb-2">Voluntary self-ID</p>
                <div className="flex flex-wrap gap-2">
                  {cl.gender ? <Chip>Gender: {String(cl.gender)}</Chip> : null}
                  {cl.raceEthnicity ? <Chip>Ethnicity: {String(cl.raceEthnicity)}</Chip> : null}
                  <Chip>Veteran: {String(cl.veteran ?? "prefer not")}</Chip>
                  <Chip>Disability: {String(cl.disability ?? "prefer not")}</Chip>
                </div>
              </div>
            </div>
          </SectionCard>

          {/* Custom sections (user-added) + add modal */}
          <CustomSections profile={profile} />
        </div>

        {/* Sticky TOC (highlights the section in view) */}
        <ProfileToc />
      </div>
    </div>
  );
}
