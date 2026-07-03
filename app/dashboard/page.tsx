import { and, desc, eq, gte, ilike, or } from "drizzle-orm";
import { Sparkles, ListChecks } from "lucide-react";
import { getSession } from "@/lib/get-session";
import { db } from "@/lib/db";
import { matches as matchesTable, jobs, companies, applications, users } from "@/lib/db/schema";
import { locationCondition, seniorityCondition, SENIORITY, workplaceCondition, WORKPLACE, sponsorCondition } from "@/lib/jobs/filters";
import { stripHtml } from "@/lib/ats/util";
import { DashboardFilters } from "@/components/dashboard/dashboard-filters";
import { DiscoverButton } from "@/components/dashboard/discover-button";
import { AddYourOwn } from "@/components/dashboard/add-your-own";
import { MatchCard } from "@/components/dashboard/match-card";
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

// Clean a raw job description for display in the drawer: strip HTML, remove links and
// emails (the user asked for "no links or anything"), and tidy whitespace.
function cleanJd(raw: string | null): string {
  if (!raw) return "";
  let t = stripHtml(raw);
  t = t.replace(/https?:\/\/\S+/gi, "").replace(/\bwww\.\S+/gi, "").replace(/\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g, "");
  t = t.replace(/[ \t]+/g, " ").replace(/ *\n */g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  return t.slice(0, 8000);
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; loc?: string; lvl?: string; work?: string; sponsor?: string; view?: string }>;
}) {
  const session = await getSession();
  const { q, loc: locParam, lvl: lvlParam, work: workParam, sponsor: sponsorParam, view } = await searchParams;
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
          rawJd: jobs.rawJd,
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

  const matchCards = rows.map((m) => ({
    id: m.id,
    title: m.title,
    location: m.location ?? "",
    remotePolicy: m.remotePolicy,
    postedAgo: timeAgo(m.postedAt),
    company: m.company,
    logoUrl: m.logoUrl,
    score: m.score,
    reason: (m.reasons as { reason?: string } | null)?.reason ?? "",
    appState: m.appState,
    description: cleanJd(m.rawJd),
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
        initialTab={view === "apps" ? "apps" : "matches"}
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
          {matchCards.map((card) => (
            <MatchCard key={card.id} card={card} />
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
