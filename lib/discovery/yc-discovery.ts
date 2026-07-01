import { db } from "@/lib/db";
import { companies } from "@/lib/db/schema";
import { probeYcCompanies, type Co } from "@/lib/ats/yc-probe";
import { enqueueDiscoverCompany } from "@/lib/queue";

// Public, maintained mirror of the YC company directory (no auth, refreshed regularly).
const YC_DIRECTORY = "https://yc-oss.github.io/api/companies/all.json";

// Auto-discover startup ATS boards (Ashby/Greenhouse/Lever/Workable) and enroll them
// as watched companies — no manual seeding. We fetch the YC directory, derive slugs,
// probe the ATS public APIs (lib/ats/yc-probe), upsert the hits, and queue an
// immediate crawl of the newly enrolled boards. Idempotent: existing boards are
// skipped on conflict, so each run only adds what's new.
export async function discoverYcBoards(
  opts: { limit?: number; concurrency?: number; all?: boolean } = {},
): Promise<{ scanned: number; hits: number; enrolled: number }> {
  const res = await fetch(YC_DIRECTORY, { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(60000) });
  if (!res.ok) throw new Error(`YC directory: HTTP ${res.status}`);
  const all = (await res.json()) as Co[];

  let cos = all.filter((c) => c.website && c.status === "Active");
  // Focus on companies flagged as actively hiring (smaller, higher-signal) unless the
  // caller asks for the full active set. Falls back to all-active if the flag is sparse.
  if (!opts.all) {
    const hiring = cos.filter((c) => c.isHiring);
    if (hiring.length >= 100) cos = hiring;
  }

  const hits = await probeYcCompanies(cos, { limit: opts.limit, concurrency: opts.concurrency ?? 10 });

  const seen = new Set<string>();
  const rows = hits
    .filter((h) => { const k = `${h.ats}:${h.slug}`; if (seen.has(k)) return false; seen.add(k); return true; })
    .map((h) => ({ name: h.name.slice(0, 120), ats: h.ats, atsSlug: h.slug, logoUrl: h.logoUrl }));

  let enrolled = 0;
  for (let i = 0; i < rows.length; i += 200) {
    const inserted = await db
      .insert(companies)
      .values(rows.slice(i, i + 200))
      .onConflictDoNothing({ target: [companies.ats, companies.atsSlug] })
      .returning({ id: companies.id, slug: companies.atsSlug, ats: companies.ats });
    enrolled += inserted.length;
    // Crawl the newly enrolled boards now; the 8h cycle keeps them fresh after.
    for (const c of inserted) await enqueueDiscoverCompany({ companyId: c.id, slug: c.slug, ats: c.ats });
  }

  return { scanned: cos.length, hits: hits.length, enrolled };
}
