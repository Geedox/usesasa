// Arbeitnow (arbeitnow.com) — EU + remote jobs. Clean public JSON API, paginated:
// /api/job-board-api?page=N -> { data: [...], links: { next } }. Zero seeding.
import { type AggregatorJob } from "./remoteok";
import { stripHtml, inferRemote } from "./util";

const MAX_PAGES = Number(process.env.ARBEITNOW_MAX_PAGES || 15);

type AJob = {
  slug?: string;
  company_name?: string;
  title?: string;
  description?: string;
  remote?: boolean;
  url?: string;
  location?: string;
  created_at?: number; // unix seconds
};

export async function fetchArbeitnowJobs(): Promise<AggregatorJob[]> {
  const out: AggregatorJob[] = [];
  const seen = new Set<string>();

  for (let page = 1; page <= MAX_PAGES; page++) {
    let data: AJob[] = [];
    try {
      const res = await fetch(`https://www.arbeitnow.com/api/job-board-api?page=${page}`, {
        headers: { "User-Agent": "SasaBot/1.0 (+https://usesasa.xyz)", Accept: "application/json" },
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) break;
      data = ((await res.json()) as { data?: AJob[] }).data ?? [];
    } catch {
      break;
    }
    if (data.length === 0) break;

    for (const j of data) {
      if (!j.slug || !j.title || seen.has(j.slug)) continue;
      seen.add(j.slug);
      const loc = j.location || "";
      out.push({
        company: (j.company_name || "Arbeitnow").slice(0, 120),
        externalId: `arbeitnow-${j.slug}`,
        title: j.title.slice(0, 200),
        url: j.url || "",
        location: j.remote ? loc || "Remote" : loc,
        remotePolicy: inferRemote(loc, j.remote),
        postedAt: j.created_at ? new Date(j.created_at * 1000) : null,
        rawJd: j.description ? stripHtml(j.description).slice(0, 8000) : "",
      });
    }
  }
  return out;
}
