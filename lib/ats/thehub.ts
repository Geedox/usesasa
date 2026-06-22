// The Hub (thehub.io) — Nordic/EU startup jobs, lots of remote + internship roles.
// Clean JSON API (no LLM/Steel): /api/jobs?page=N returns { docs, total, page, pages }.
import { type AggregatorJob } from "./remoteok";
import { stripHtml, inferRemote } from "./util";

const MAX_PAGES = Number(process.env.THEHUB_MAX_PAGES || 80);

type HubDoc = {
  id?: string;
  title?: string;
  company?: { name?: string };
  description?: string;
  location?: { address?: string; locality?: string; country?: string };
  isRemote?: boolean;
  link?: string;
  absoluteJobUrl?: string;
  publishedAt?: string;
  createdAt?: string;
};
type HubPage = { docs?: HubDoc[]; total?: number; page?: number; pages?: number };

export async function fetchTheHubJobs(): Promise<AggregatorJob[]> {
  const out: AggregatorJob[] = [];
  const seen = new Set<string>();

  for (let page = 1; page <= MAX_PAGES; page++) {
    let data: HubPage;
    try {
      const res = await fetch(`https://thehub.io/api/jobs?page=${page}`, {
        headers: { "User-Agent": "SasaBot/1.0 (+https://usesasa.xyz)", Accept: "application/json" },
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) break;
      data = (await res.json()) as HubPage;
    } catch {
      break;
    }
    const docs = data.docs ?? [];
    if (docs.length === 0) break;

    for (const d of docs) {
      if (!d.id || !d.title || seen.has(d.id)) continue;
      seen.add(d.id);
      const loc = d.location?.address || [d.location?.locality, d.location?.country].filter(Boolean).join(", ");
      out.push({
        company: (d.company?.name || "The Hub").slice(0, 120),
        externalId: `thehub-${d.id}`,
        title: d.title.slice(0, 200),
        url: d.link || d.absoluteJobUrl || `https://thehub.io/jobs/${d.id}`,
        location: d.isRemote ? "Remote" : loc || "",
        remotePolicy: d.isRemote ? "remote" : inferRemote(loc),
        postedAt: d.publishedAt || d.createdAt ? new Date(d.publishedAt || d.createdAt!) : null,
        rawJd: d.description ? stripHtml(d.description).slice(0, 8000) : "",
      });
    }

    if (data.pages && page >= data.pages) break; // last page
  }
  return out;
}
