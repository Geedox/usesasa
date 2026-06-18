import { and, desc, eq, ilike, inArray, isNull, or, sql, type SQL } from "drizzle-orm";
import Link from "next/link";
import { Search } from "lucide-react";
import { getSession } from "@/lib/get-session";
import { db } from "@/lib/db";
import { matches as matchesTable, jobs, companies, applications } from "@/lib/db/schema";
import { ApplyButton } from "@/components/dashboard/apply-button";

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

function statusBadge(state: string | null): { label: string; cls: string } | null {
  switch (state) {
    case "submitted":
      return { label: "Applied", cls: "bg-green-100 text-green-700" };
    case "queued":
    case "sending":
      return { label: "In flight", cls: "bg-blue-100 text-blue-700" };
    case "awaiting_review":
      return { label: "Review", cls: "bg-amber-100 text-amber-800" };
    case "needs_user":
      return { label: "Needs you", cls: "bg-amber-100 text-amber-800" };
    case "dismissed":
      return { label: "Skipped", cls: "bg-foreground/[0.06] text-muted-foreground" };
    default:
      return null;
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
  searchParams: Promise<{ page?: string; q?: string; status?: string }>;
}) {
  const session = await getSession();
  if (!session) return null;
  const { page: pageParam, q, status: statusParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const query = (q ?? "").trim();
  const status: FilterKey = (FILTERS.find((f) => f.key === statusParam)?.key ?? "all") as FilterKey;

  const where = and(
    eq(matchesTable.userId, session.user.id),
    query ? or(ilike(jobs.title, `%${query}%`), ilike(companies.name, `%${query}%`)) : undefined,
    statusCondition(status),
  );

  const base = db
    .select({
      id: jobs.id,
      title: jobs.title,
      location: jobs.location,
      remotePolicy: jobs.remotePolicy,
      postedAt: jobs.postedAt,
      company: companies.name,
      score: matchesTable.score,
      appId: applications.id,
      appState: applications.state,
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
  const url = (p: Record<string, string | number>) => {
    const sp = new URLSearchParams();
    if (status !== "all") sp.set("status", status);
    if (query) sp.set("q", query);
    for (const [k, v] of Object.entries(p)) sp.set(k, String(v));
    const s = sp.toString();
    return `/dashboard/browse${s ? `?${s}` : ""}`;
  };
  const filterUrl = (key: string) => {
    const sp = new URLSearchParams();
    if (key !== "all") sp.set("status", key);
    if (query) sp.set("q", query);
    const s = sp.toString();
    return `/dashboard/browse${s ? `?${s}` : ""}`;
  };

  return (
    <main className="max-w-[1100px] mx-auto px-6 lg:px-10 py-8">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="font-display text-3xl tracking-tight">Browse jobs</h1>
          <p className="text-sm text-muted-foreground">
            Every role we have scored for you. {totalCount.toLocaleString()} {status === "all" ? "total" : "shown"}.
          </p>
        </div>
        <form className="flex items-center gap-2 rounded-lg border border-foreground/10 bg-background px-3 h-10 w-full sm:w-80">
          {status !== "all" && <input type="hidden" name="status" value={status} />}
          <Search className="w-4 h-4 text-muted-foreground" />
          <input name="q" defaultValue={query} placeholder="Search title or company" className="flex-1 bg-transparent outline-none text-sm" />
        </form>
      </div>

      {/* Status filters */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={filterUrl(f.key)}
            className={`rounded-full px-3 py-1 text-sm cursor-pointer ${
              status === f.key ? "bg-foreground text-background" : "border border-foreground/15 text-muted-foreground hover:text-foreground hover:border-foreground/40"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-foreground/15 bg-background py-20 text-center">
          <p className="font-display text-xl mb-2">Nothing here</p>
          <p className="text-sm text-muted-foreground">
            {query || status !== "all" ? "No roles match this filter." : "Run a search from the dashboard and scored roles will appear here."}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-foreground/10 bg-background overflow-hidden">
          {rows.map((m) => {
            const badge = statusBadge(m.appState);
            return (
              <div key={m.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-4 px-5 py-4 border-b border-foreground/5 last:border-b-0">
                <div className="w-12 text-center">
                  <div className="font-display text-lg leading-none">{m.score}%</div>
                  <div className="font-mono text-[9px] tracking-widest text-muted-foreground uppercase mt-1">match</div>
                </div>
                <div className="min-w-0">
                  <div className="font-medium truncate">{m.title}</div>
                  <div className="text-sm text-muted-foreground truncate">
                    {m.company}
                    {m.location ? ` · ${m.location}` : m.remotePolicy === "remote" ? " · Remote" : ""}
                    {m.postedAt ? ` · ${timeAgo(m.postedAt)}` : ""}
                  </div>
                </div>
                {badge ? (
                  <Link
                    href={m.appId ? `/dashboard/applications/${m.appId}` : "#"}
                    className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${badge.cls}`}
                  >
                    {badge.label}
                  </Link>
                ) : (
                  <ApplyButton jobId={m.id} />
                )}
              </div>
            );
          })}
        </div>
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
  );
}
