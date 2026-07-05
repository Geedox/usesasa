import { and, desc, eq, ilike, inArray, isNull, or, sql, type SQL } from "drizzle-orm";
import Link from "next/link";
import { getSession } from "@/lib/get-session";
import { db } from "@/lib/db";
import { matches as matchesTable, jobs, companies, applications } from "@/lib/db/schema";
import { AddYourOwn } from "@/components/dashboard/add-your-own";
import { MatchCard } from "@/components/dashboard/match-card";
import { BrowseFilters } from "@/components/dashboard/browse-filters";
import { CreditGate } from "@/components/dashboard/credit-gate";
import { belowCreditFloor } from "@/lib/can-use";
import { cleanJobDescription } from "@/lib/ats/util";
import { prefersManualApply } from "@/lib/submit/input";
import { locationCondition, seniorityCondition, SENIORITY, workplaceCondition, WORKPLACE, sponsorCondition } from "@/lib/jobs/filters";

const PAGE_SIZE = 20;

const FILTERS = [
  { key: "all", label: "All" },
  { key: "applied", label: "Applied" },
  { key: "review", label: "Needs you" },
  { key: "inflight", label: "In flight" },
  { key: "skipped", label: "Skipped" },
  { key: "new", label: "Not applied" },
] as const;
type FilterKey = (typeof FILTERS)[number]["key"];

function statusCondition(key: string): SQL | undefined {
  switch (key) {
    case "applied":
      return eq(applications.state, "submitted");
    case "review":
      return inArray(applications.state, ["needs_user", "awaiting_review"]);
    case "inflight":
      return inArray(applications.state, ["queued", "sending"]);
    case "skipped":
      return or(eq(applications.state, "dismissed"), eq(matchesTable.userAction, "skipped"));
    case "new":
      return isNull(applications.id);
    default:
      return undefined;
  }
}

function timeAgo(date: Date | null): string {
  if (!date) return "";
  const days = Math.floor((Date.now() - date.getTime()) / 86400000);
  if (days <= 0) return "today";
  if (days === 1) return "1 day ago";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? "1 month ago" : `${months} months ago`;
}

export default async function BrowsePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; status?: string; loc?: string; lvl?: string; work?: string; sponsor?: string }>;
}) {
  const session = await getSession();
  if (!session) return null;
  const { page: pageParam, q, status: statusParam, loc: locParam, lvl: lvlParam, work: workParam, sponsor: sponsorParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const query = (q ?? "").trim();
  const status: FilterKey = (FILTERS.find((f) => f.key === statusParam)?.key ?? "all") as FilterKey;
  const loc = (locParam ?? "").trim();
  const lvl = SENIORITY.find((s) => s.key === lvlParam)?.key ?? "";
  const work = WORKPLACE.find((w) => w.key === workParam)?.key ?? "";
  const sponsor = sponsorParam === "1";
  const blocked = await belowCreditFloor(session.user.id);

  const where = and(
    eq(matchesTable.userId, session.user.id),
    query ? or(ilike(jobs.title, `%${query}%`), ilike(companies.name, `%${query}%`), ilike(jobs.location, `%${query}%`)) : undefined,
    statusCondition(status),
    locationCondition(loc),
    seniorityCondition(lvl),
    workplaceCondition(work),
    sponsorCondition(sponsor),
  );

  // Carry all active filters when building any link.
  const buildUrl = (over: Record<string, string | number>) => {
    const sp = new URLSearchParams();
    if (status !== "all") sp.set("status", status);
    if (query) sp.set("q", query);
    if (loc) sp.set("loc", loc);
    if (lvl) sp.set("lvl", lvl);
    if (work) sp.set("work", work);
    if (sponsor) sp.set("sponsor", "1");
    for (const [k, v] of Object.entries(over)) { if (v === "") sp.delete(k); else sp.set(k, String(v)); }
    const s = sp.toString();
    return `/dashboard/browse${s ? `?${s}` : ""}`;
  };

  // Build the country/location chips from the user's own matched roles so they are
  // relevant (last comma-segment of the location = the country/place).
  const locRows = await db
    .selectDistinct({ location: jobs.location })
    .from(matchesTable)
    .innerJoin(jobs, eq(matchesTable.jobId, jobs.id))
    .where(eq(matchesTable.userId, session.user.id));
  const counts = new Map<string, number>();
  let hasRemote = false;
  for (const r of locRows) {
    const l = (r.location ?? "").trim();
    if (!l) continue;
    if (/remote/i.test(l)) hasRemote = true;
    const country = l.split(",").pop()!.trim();
    if (country && !/remote/i.test(country)) counts.set(country, (counts.get(country) ?? 0) + 1);
  }
  const locChips = [
    ...(hasRemote ? ["Remote"] : []),
    ...[...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([c]) => c),
  ];

  const base = db
    .select({
      id: jobs.id,
      title: jobs.title,
      location: jobs.location,
      remotePolicy: jobs.remotePolicy,
      postedAt: jobs.postedAt,
      rawJd: jobs.rawJd,
      source: jobs.source,
      company: companies.name,
      logoUrl: companies.logoUrl,
      score: matchesTable.score,
      reasons: matchesTable.reasons,
      appId: applications.id,
      appState: applications.state,
      appVia: applications.submittedVia,
    })
    .from(matchesTable)
    .innerJoin(jobs, eq(matchesTable.jobId, jobs.id))
    .innerJoin(companies, eq(jobs.companyId, companies.id))
    .leftJoin(applications, and(eq(applications.userId, session.user.id), eq(applications.jobId, matchesTable.jobId)));

  const [{ total }] = await db
    .select({ total: sql<number>`count(*)` })
    .from(matchesTable)
    .innerJoin(jobs, eq(matchesTable.jobId, jobs.id))
    .innerJoin(companies, eq(jobs.companyId, companies.id))
    .leftJoin(applications, and(eq(applications.userId, session.user.id), eq(applications.jobId, matchesTable.jobId)))
    .where(where);

  const rows = await base
    .where(where)
    .orderBy(desc(matchesTable.score), desc(jobs.postedAt))
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE);

  const totalCount = Number(total);
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const url = (p: Record<string, string | number>) => buildUrl(p);

  return (
    <CreditGate blocked={blocked}>
    <main className="max-w-[1400px] mx-auto px-6 lg:px-10 py-8">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="font-display text-3xl tracking-tight">Browse jobs</h1>
          <p className="text-sm text-muted-foreground">
            Every role we have scored for you. {totalCount.toLocaleString()} {status === "all" ? "total" : "shown"}.
          </p>
        </div>
      </div>

      {/* Sticky filter bar — the grid scrolls under it (like the dashboard) */}
      <div className="sticky top-0 z-20 -mx-6 lg:-mx-10 px-6 lg:px-10 py-4 mb-6 bg-[#f6f7f8] border-b border-foreground/10">
        <BrowseFilters
          statuses={FILTERS.map((f) => ({ key: f.key, label: f.label }))}
          levels={SENIORITY.map((s) => ({ key: s.key, label: s.label }))}
          workplaces={WORKPLACE.map((w) => ({ key: w.key, label: w.label }))}
          locChips={locChips}
          initial={{ q: query, loc, status, lvl, work, sponsor }}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 mb-8">
        {/* First card: add your own career page */}
        <AddYourOwn variant="card" />

        {rows.map((m) => (
          <MatchCard
            key={m.id}
            card={{
              id: m.id,
              title: m.title,
              location: m.location ?? "",
              remotePolicy: m.remotePolicy,
              postedAgo: timeAgo(m.postedAt),
              company: m.company,
              logoUrl: m.logoUrl,
              score: m.score,
              reason: (m.reasons as { reason?: string } | null)?.reason ?? "",
              locationTag: (m.reasons as { tag?: string } | null)?.tag ?? "",
              appState: m.appState,
              appVia: m.appVia,
              description: cleanJobDescription(m.rawJd),
              manualApply: prefersManualApply(m.source),
            }}
          />
        ))}
      </div>

      {rows.length === 0 && (
        <p className="text-sm text-muted-foreground -mt-4 mb-8">
          {query || status !== "all" || loc || lvl || work || sponsor ? "No roles match these filters." : "Run a search and scored roles will appear here."}
        </p>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6 text-sm">
          {page > 1 ? (
            <Link href={url({ page: page - 1 })} className="rounded-lg border border-foreground/15 px-4 py-2 hover:border-foreground/40">
              Previous
            </Link>
          ) : (
            <span className="rounded-lg border border-foreground/10 px-4 py-2 text-muted-foreground/40">Previous</span>
          )}
          <span className="text-muted-foreground">Page {page} of {totalPages}</span>
          {page < totalPages ? (
            <Link href={url({ page: page + 1 })} className="rounded-lg border border-foreground/15 px-4 py-2 hover:border-foreground/40">
              Next
            </Link>
          ) : (
            <span className="rounded-lg border border-foreground/10 px-4 py-2 text-muted-foreground/40">Next</span>
          )}
        </div>
      )}
    </main>
    </CreditGate>
  );
}
