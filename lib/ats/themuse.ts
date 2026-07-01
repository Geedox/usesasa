// The Muse (themuse.com) — global jobs incl. internships, with company data. Clean
// public JSON API, paginated: /api/public/jobs?page=N -> { results, page_count }.
import { type AggregatorJob } from "./remoteok";
import { stripHtml, inferRemote } from "./util";

const MAX_PAGES = Number(process.env.THEMUSE_MAX_PAGES || 20);

type MJob = {
  id?: number | string;
  name?: string;
  contents?: string;
  publication_date?: string;
  locations?: { name?: string }[];
  company?: { name?: string };
  refs?: { landing_page?: string };
};

export async function fetchTheMuseJobs(): Promise<AggregatorJob[]> {
  const out: AggregatorJob[] = [];
  const seen = new Set<string>();

  for (let page = 0; page < MAX_PAGES; page++) {
    let body: { results?: MJob[]; page_count?: number };
    try {
      const res = await fetch(`https://www.themuse.com/api/public/jobs?page=${page}`, {
        headers: { "User-Agent": "SasaBot/1.0 (+https://usesasa.xyz)", Accept: "application/json" },
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) break;
      body = (await res.json()) as { results?: MJob[]; page_count?: number };
    } catch {
      break;
    }
    const results = body.results ?? [];
    if (results.length === 0) break;

    for (const j of results) {
      if (j.id == null || !j.name) continue;
      const id = String(j.id);
      if (seen.has(id)) continue;
      seen.add(id);
      const loc = (j.locations ?? []).map((l) => l.name).filter(Boolean).join(", ");
      out.push({
        company: (j.company?.name || "The Muse").slice(0, 120),
        externalId: `themuse-${id}`,
        title: j.name.slice(0, 200),
        url: j.refs?.landing_page || "",
        location: loc,
        remotePolicy: inferRemote(loc),
        postedAt: j.publication_date ? new Date(j.publication_date) : null,
        rawJd: j.contents ? stripHtml(j.contents).slice(0, 8000) : "",
      });
    }

    if (body.page_count && page + 1 >= body.page_count) break;
  }
  return out;
}
