import { and, desc, eq, gte } from "drizzle-orm";
import { Search, Sparkles, ListChecks } from "lucide-react";
import { getSession } from "@/lib/get-session";
import { db } from "@/lib/db";
import { matches as matchesTable, jobs, companies, applications, users } from "@/lib/db/schema";
import { DiscoverButton } from "@/components/dashboard/discover-button";
import { AddYourOwn } from "@/components/dashboard/add-your-own";
import { ApplyButton } from "@/components/dashboard/apply-button";
import { ScanningMatches } from "@/components/dashboard/scanning-matches";
import { ExtensionModal } from "@/components/dashboard/extension-modal";
import { ApplicationsTable } from "@/components/dashboard/applications-table";
import { MATCH_THRESHOLD } from "@/lib/matching/score";

function timeAgo(date: Date | null): string {
  if (!date) return "";
  const days = Math.floor((Date.now() - date.getTime()) / 86400000);
  if (days <= 0) return "today";
  if (days === 1) return "1 day ago";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? "1 month ago" : `${months} months ago`;
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

const filters = ["Date", "Location", "Workplace", "Salary", "Experience", "Sponsors visa", "Role", "Job type", "More"];

export default async function DashboardPage() {
  const session = await getSession();
  const rows = session
    ? await db
        .select({
          id: jobs.id,
          title: jobs.title,
          location: jobs.location,
          remotePolicy: jobs.remotePolicy,
          postedAt: jobs.postedAt,
          company: companies.name,
          score: matchesTable.score,
          reasons: matchesTable.reasons,
        })
        .from(matchesTable)
        .innerJoin(jobs, eq(matchesTable.jobId, jobs.id))
        .innerJoin(companies, eq(jobs.companyId, companies.id))
        .where(and(eq(matchesTable.userId, session.user.id), gte(matchesTable.score, MATCH_THRESHOLD)))
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
    <main className="max-w-[1400px] mx-auto px-6 lg:px-10 pb-12">
      <ExtensionModal connected={extensionConnected} />
      {/* Sticky search + filters — content scrolls under this */}
      <div className="sticky top-0 z-20 -mx-6 lg:-mx-10 px-6 lg:px-10 pt-6 pb-4 bg-[#f6f7f8] border-b border-foreground/10">
        {/* Search */}
        <div className="flex items-center gap-3 rounded-xl border border-foreground/10 bg-background px-4 h-12 mb-4">
          <Search className="w-4 h-4 text-muted-foreground" />
          <input
            placeholder="Search by title, company..."
            className="flex-1 bg-transparent outline-none text-sm"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {filters.map((f) => (
            <button
              key={f}
              className="rounded-full border border-foreground/15 px-4 py-1.5 text-sm text-muted-foreground hover:border-foreground/40 hover:text-foreground transition-colors cursor-pointer"
            >
              {f}
            </button>
          ))}
          <button className="ml-auto rounded-full bg-foreground text-background px-4 py-1.5 text-sm cursor-pointer hover:bg-foreground/90">
            Apply
          </button>
        </div>
      </div>

      {/* Top job matches */}
      <div className="flex items-center justify-between mt-8 mb-4">
        <h2 className="font-display text-2xl tracking-tight">Top job matches</h2>
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
              <div className="flex items-center justify-between mt-auto pt-2">
                <span className="text-sm font-medium">{m.company}</span>
                <div className="flex items-center gap-2">
                  <button className="rounded-lg border border-foreground/15 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:border-foreground/40 cursor-pointer">
                    Pass
                  </button>
                  <ApplyButton jobId={m.id} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* All applications */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-2xl tracking-tight">All applications</h2>
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
    </main>
  );
}
