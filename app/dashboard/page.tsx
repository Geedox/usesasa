import { and, desc, eq, gte, ilike, or } from "drizzle-orm";
import { Sparkles, ListChecks } from "lucide-react";
import { getSession } from "@/lib/get-session";
import { db } from "@/lib/db";
import { matches as matchesTable, jobs, companies, applications, users } from "@/lib/db/schema";
import { locationCondition, seniorityCondition, SENIORITY, workplaceCondition, WORKPLACE, sponsorCondition } from "@/lib/jobs/filters";
import { DashboardFilters } from "@/components/dashboard/dashboard-filters";
import { CompanyAvatar } from "@/components/dashboard/company-avatar";
import { DiscoverButton } from "@/components/dashboard/discover-button";
import { AddYourOwn } from "@/components/dashboard/add-your-own";
import { ApplyButton } from "@/components/dashboard/apply-button";
import { ScanningMatches } from "@/components/dashboard/scanning-matches";
import { ExtensionModal } from "@/components/dashboard/extension-modal";
import { ApplicationsTable } from "@/components/dashboard/applications-table";
import { ReferralBanner } from "@/components/dashboard/referral-banner";
import { CreditGate } from "@/components/dashboard/credit-gate";
import { DashboardTabs } from "@/components/dashboard/dashboard-tabs";
import { MATCH_THRESHOLD } from "@/lib/matching/score";
import { belowCreditFloor } from "@/lib/can-use";
import { SITE_URL } from "@/lib/site";

function timeAgo(date: Date | null): string {
  if (!date) return "";
  const days = Math.floor((Date.now() - date.getTime()) / 86400000);
  if (days <= 0) return "today";
  if (days === 1) return "1 day ago";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? "1 month ago" : `${months} months ago`;
}

// Map an application's state to a status pill shown on a match card, so a job we are
// already working on shows its real state instead of resetting to "Apply" on refresh.
function matchStatus(state: string | null): { label: string; cls: string } | null {
  switch (state) {
    case "drafted":
      return { label: "Drafting…", cls: "bg-amber-100 text-amber-700" };
    case "awaiting_review":
      return { label: "Review", cls: "bg-sky-100 text-sky-700" };
    case "queued":
      return { label: "Queued", cls: "bg-sky-100 text-sky-700" };
    case "sending":
      return { label: "Sending…", cls: "bg-amber-100 text-amber-700" };
    case "submitted":
      return { label: "Applied", cls: "bg-emerald-100 text-emerald-700" };
    case "needs_user":
      return { label: "Needs you", cls: "bg-rose-100 text-rose-700" };
    case "failed":
      return { label: "Failed", cls: "bg-rose-100 text-rose-700" };
    default:
      return null; // no application yet, or dismissed → show Apply
  }
}

function MatchRing({ value }: { value: number }) {
  const r = 20;
  const c = 2 * Math.PI * r;
  const dash = (Math.min(Math.max(value, 0), 100) / 100) * c;
  return (
    <div className="relative w-12 h-12 shrink-0">
      <svg viewBox="0 0 48 48" className="w-12 h-12 -rotate-90">
        <circle cx="24" cy="24" r={r} fill="none" strokeWidth="3" stroke="currentColor" className="text-foreground/10" />
        <circle
          cx="24"
          cy="24"
          r={r}
          fill="none"
          strokeWidth="3"
          strokeLinecap="round"
          stroke="currentColor"
          className="text-foreground"
          strokeDasharray={`${dash} ${c}`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xs font-medium leading-none">{value}%</span>
        <span className="font-mono text-[7px] tracking-widest text-muted-foreground uppercase mt-0.5">match</span>
      </div>
    </div>
  );
}


export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; loc?: string; lvl?: string; work?: string; sponsor?: string }>;
}) {
  const session = await getSession();
  const { q, loc: locParam, lvl: lvlParam, work: workParam, sponsor: sponsorParam } = await searchParams;
  const query = (q ?? "").trim();
  const loc = (locParam ?? "").trim();
  const lvl = SENIORITY.find((s) => s.key === lvlParam)?.key ?? "";
  const work = WORKPLACE.find((w) => w.key === workParam)?.key ?? "";
  const sponsor = sponsorParam === "1";

  // Blur the dashboard when the user has no usable credits (also stops their scans).
  const blocked = session ? await belowCreditFloor(session.user.id) : false;

  const rows = session
    ? await db
        .select({
          id: jobs.id,
          title: jobs.title,
          location: jobs.location,
          remotePolicy: jobs.remotePolicy,
          postedAt: jobs.postedAt,
          company: companies.name,
          logoUrl: companies.logoUrl,
          score: matchesTable.score,
          reasons: matchesTable.reasons,
          appState: applications.state,
        })
        .from(matchesTable)
        .innerJoin(jobs, eq(matchesTable.jobId, jobs.id))
        .innerJoin(companies, eq(jobs.companyId, companies.id))
        .leftJoin(applications, and(eq(applications.jobId, jobs.id), eq(applications.userId, session.user.id)))
        .where(and(
          eq(matchesTable.userId, session.user.id),
          gte(matchesTable.score, MATCH_THRESHOLD),
          query ? or(ilike(jobs.title, `%${query}%`), ilike(companies.name, `%${query}%`)) : undefined,
          locationCondition(loc),
          seniorityCondition(lvl),
          workplaceCondition(work),
          sponsorCondition(sponsor),
        ))
        .orderBy(desc(matchesTable.surfacedAt), desc(matchesTable.score))
        .limit(30)
    : [];

  const appRows = session
    ? await db
        .select({
          id: applications.id,
          state: applications.state,
          createdAt: applications.createdAt,
          submittedAt: applications.submittedAt,
          coverLetterText: applications.coverLetterText,
          tailoredCv: applications.tailoredCv,
          tailoringValidation: applications.tailoringValidation,
          title: jobs.title,
          company: companies.name,
        })
        .from(applications)
        .innerJoin(jobs, eq(applications.jobId, jobs.id))
        .innerJoin(companies, eq(jobs.companyId, companies.id))
        .where(eq(applications.userId, session.user.id))
        .orderBy(desc(applications.createdAt))
        .limit(50)
    : [];

  const applicationRows = appRows.map((a) => ({
    id: a.id,
    state: a.state,
    company: a.company,
    title: a.title,
    cvReady: Boolean(a.tailoredCv),
    coverReady: Boolean(a.coverLetterText),
    embellished: (a.tailoringValidation as { embellished?: boolean } | null)?.embellished === true,
    appliedAt: (a.submittedAt ?? a.createdAt)?.toISOString() ?? null,
  }));

  const userRow = session
    ? await db.query.users.findFirst({ where: eq(users.id, session.user.id) })
    : null;
  const extensionConnected = Boolean(userRow?.extensionTokenHash);

  return (
    <CreditGate blocked={blocked}>
    <main className="max-w-[1400px] mx-auto px-6 lg:px-10 pb-12">
      <ExtensionModal connected={extensionConnected} />
      {userRow?.referralCode && (
        <div className="pt-6">
          <ReferralBanner code={userRow.referralCode} shareUrl={`${SITE_URL}/?ref=${userRow.referralCode}`} />
        </div>
      )}
      {/* Sticky search + filters — content scrolls under this */}
      <div className="sticky top-0 z-20 -mx-6 lg:-mx-10 px-6 lg:px-10 pt-6 pb-4 bg-[#f6f7f8] border-b border-foreground/10">
        <DashboardFilters
          levels={SENIORITY.map((s) => ({ key: s.key, label: s.label }))}
          workplaces={WORKPLACE.map((w) => ({ key: w.key, label: w.label }))}
          q={query}
          loc={loc}
          lvl={lvl}
          work={work}
          sponsor={sponsor}
        />
      </div>

      <DashboardTabs
        matchCount={rows.length}
        appCount={applicationRows.length}
        matches={
          <>
      <div className="flex items-center justify-end mb-4">
        <div className="flex items-center gap-2">
          <AddYourOwn />
          <DiscoverButton label={rows.length ? "Find more" : "Find jobs"} />
          {rows.length > 0 && (
            <span className="relative inline-flex overflow-hidden rounded-full p-[2px]">
              <span
                aria-hidden
                className="absolute left-1/2 top-1/2 h-[300%] w-[300%] animate-border-spin bg-[conic-gradient(from_0deg,#22c55e,#3b82f6,#a855f7,#22c55e)]"
              />
              <button className="relative z-10 inline-flex items-center gap-2 rounded-full bg-foreground text-background px-4 py-1.5 text-sm cursor-pointer hover:bg-foreground/90">
                <Sparkles className="w-4 h-4" /> Apply to all {rows.length}
              </button>
            </span>
          )}
        </div>
      </div>

      {rows.length === 0 ? (
        <ScanningMatches />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 mb-12">
          {rows.map((m) => (
            <div key={m.id} className="rounded-xl border border-foreground/10 bg-background p-5 flex flex-col">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="text-xs text-muted-foreground">{m.location || (m.remotePolicy === "remote" ? "Remote" : "")}</div>
                  <div className="text-xs text-muted-foreground">{timeAgo(m.postedAt)}</div>
                </div>
                <MatchRing value={m.score} />
              </div>
              <h3 className="font-display text-xl tracking-tight mb-3 leading-snug">{m.title}</h3>
              <p className="text-sm text-muted-foreground mb-5 line-clamp-3">{(m.reasons as { reason?: string } | null)?.reason}</p>
              <div className="flex items-center justify-between gap-2 mt-auto pt-2">
                <span className="flex items-center gap-2 min-w-0">
                  <CompanyAvatar name={m.company} logoUrl={m.logoUrl} size={28} />
                  <span className="text-sm font-medium truncate">{m.company}</span>
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  {matchStatus(m.appState) ? (
                    <span className={`rounded-lg px-3 py-1.5 text-sm font-medium ${matchStatus(m.appState)!.cls}`}>
                      {matchStatus(m.appState)!.label}
                    </span>
                  ) : (
                    <>
                      <button className="rounded-lg border border-foreground/15 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:border-foreground/40 cursor-pointer">
                        Pass
                      </button>
                      <ApplyButton jobId={m.id} />
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

          </>
        }
        applications={
          <>
      <div className="flex items-center justify-end mb-4">
        <div className="flex items-center gap-2">
          <button className="inline-flex items-center gap-2 rounded-full border border-foreground/15 px-4 py-1.5 text-sm hover:border-foreground/40 cursor-pointer">
            <ListChecks className="w-4 h-4" /> Open tracker
          </button>
          <button className="rounded-full border border-foreground/15 px-4 py-1.5 text-sm text-muted-foreground cursor-not-allowed">
            Approve all
          </button>
        </div>
      </div>

      <ApplicationsTable rows={applicationRows} />
          </>
        }
      />
    </main>
    </CreditGate>
  );
}
