import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { companies, jobs } from "@/lib/db/schema";
import { fetchRemoteOkJobs, type AggregatorJob } from "@/lib/ats/remoteok";
import { fetchWeWorkRemotelyJobs } from "@/lib/ats/weworkremotely";

export type AggregatorSource = "remoteok" | "weworkremotely";

function slugify(name: string): string {
  return (
    name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80) || "unknown"
  );
}

// Aggregators surface jobs from arbitrary employers. We create a company row per
// employer (ats = the aggregator) so the long tail of small companies is captured.
export async function crawlAggregator(source: AggregatorSource): Promise<number> {
  const items: AggregatorJob[] =
    source === "remoteok" ? await fetchRemoteOkJobs() : await fetchWeWorkRemotelyJobs();
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
        isActive: true,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  if (jobRows.length > 0) {
    await db.insert(jobs).values(jobRows).onConflictDoNothing({ target: [jobs.source, jobs.externalId] });
  }
  return items.length;
}
