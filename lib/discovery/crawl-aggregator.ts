import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { companies, jobs } from "@/lib/db/schema";
import { makeDedupeKey } from "@/lib/ats/util";
import { fetchRemoteOkJobs, type AggregatorJob } from "@/lib/ats/remoteok";
import { fetchWeWorkRemotelyJobs } from "@/lib/ats/weworkremotely";
import { fetchMyJobMagJobs } from "@/lib/ats/myjobmag";
import { fetchJobbermanJobs } from "@/lib/ats/jobberman";
import { fetchTheHubJobs } from "@/lib/ats/thehub";
import { fetchHimalayasJobs } from "@/lib/ats/himalayas";
import { fetchRemotiveJobs } from "@/lib/ats/remotive";
import { fetchArbeitnowJobs } from "@/lib/ats/arbeitnow";
import { fetchTheMuseJobs } from "@/lib/ats/themuse";

export type AggregatorSource =
  | "remoteok" | "weworkremotely" | "myjobmag" | "jobberman" | "thehub" | "himalayas"
  | "remotive" | "arbeitnow" | "themuse";

const FETCHERS: Record<AggregatorSource, () => Promise<AggregatorJob[]>> = {
  remoteok: fetchRemoteOkJobs,
  weworkremotely: fetchWeWorkRemotelyJobs,
  myjobmag: fetchMyJobMagJobs,
  jobberman: fetchJobbermanJobs,
  thehub: fetchTheHubJobs,
  himalayas: fetchHimalayasJobs,
  remotive: fetchRemotiveJobs,
  arbeitnow: fetchArbeitnowJobs,
  themuse: fetchTheMuseJobs,
};

function slugify(name: string): string {
  return (
    name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80) || "unknown"
  );
}

// Aggregators surface jobs from arbitrary employers. We create a company row per
// employer (ats = the aggregator) so the long tail of small companies is captured.
export async function crawlAggregator(source: AggregatorSource): Promise<number> {
  const items: AggregatorJob[] = await FETCHERS[source]();
  if (items.length === 0) return 0;

  // Unique employers -> company rows.
  const bySlug = new Map<string, string>(); // slug -> display name
  for (const it of items) {
    const slug = slugify(it.company);
    if (!bySlug.has(slug)) bySlug.set(slug, it.company);
  }

  await db
    .insert(companies)
    .values([...bySlug].map(([slug, name]) => ({ name, ats: source, atsSlug: slug })))
    .onConflictDoNothing({ target: [companies.ats, companies.atsSlug] });

  const slugs = [...bySlug.keys()];
  const companyRows = await db
    .select({ id: companies.id, atsSlug: companies.atsSlug })
    .from(companies)
    .where(and(eq(companies.ats, source), inArray(companies.atsSlug, slugs)));
  const idBySlug = new Map(companyRows.map((c) => [c.atsSlug, c.id]));

  const jobRows = items
    .map((it) => {
      const companyId = idBySlug.get(slugify(it.company));
      if (!companyId) return null;
      return {
        companyId,
        source,
        externalId: it.externalId,
        title: it.title,
        url: it.url,
        location: it.location,
        remotePolicy: it.remotePolicy,
        postedAt: it.postedAt,
        rawJd: it.rawJd,
        dedupeKey: makeDedupeKey(it.company, it.title),
        isActive: true,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  // Light cross-source dedup: drop postings whose normalized company|title already
  // exists as an active job (another aggregator, or a company board), and collapse
  // duplicates within this batch. Keeps the feed from showing the same role 3 times.
  const keys = [...new Set(jobRows.map((r) => r.dedupeKey).filter(Boolean))];
  const existing = new Set<string>();
  if (keys.length > 0) {
    const rows = await db
      .select({ k: jobs.dedupeKey })
      .from(jobs)
      .where(and(eq(jobs.isActive, true), inArray(jobs.dedupeKey, keys)));
    for (const r of rows) if (r.k) existing.add(r.k);
  }
  const batchSeen = new Set<string>();
  const deduped = jobRows.filter((r) => {
    if (!r.dedupeKey) return true;
    if (existing.has(r.dedupeKey) || batchSeen.has(r.dedupeKey)) return false;
    batchSeen.add(r.dedupeKey);
    return true;
  });

  if (deduped.length > 0) {
    await db.insert(jobs).values(deduped).onConflictDoNothing({ target: [jobs.source, jobs.externalId] });
  }
  return deduped.length;
}
