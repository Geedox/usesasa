import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { companies } from "@/lib/db/schema";

// Resolve a company logo from its name: Clearbit autocomplete gives the domain
// (no auth), then Google's favicon service returns an icon for ANY domain — so we
// get an image for essentially every real company, falling back to initials only
// when no domain resolves.
export async function resolveLogoUrl(name: string): Promise<string | null> {
  const q = name.trim();
  if (!q) return null;
  try {
    const res = await fetch(`https://autocomplete.clearbit.com/v1/companies/suggest?query=${encodeURIComponent(q)}`, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const d = (await res.json()) as { domain?: string }[];
    const domain = d?.[0]?.domain;
    return domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=128` : null;
  } catch {
    return null;
  }
}

// Set logos on companies that don't have one yet (capped per run). Called from the
// autonomous cycle so new companies pick up logos over time.
export async function backfillCompanyLogos(limit = 150, concurrency = 8): Promise<number> {
  const rows = await db
    .select({ id: companies.id, name: companies.name })
    .from(companies)
    .where(isNull(companies.logoUrl))
    .limit(limit);

  let set = 0;
  let i = 0;
  async function worker() {
    while (i < rows.length) {
      const r = rows[i++];
      const logo = await resolveLogoUrl(r.name);
      if (logo) {
        await db.update(companies).set({ logoUrl: logo }).where(and(eq(companies.id, r.id), isNull(companies.logoUrl)));
        set++;
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, rows.length) }, worker));
  return set;
}
