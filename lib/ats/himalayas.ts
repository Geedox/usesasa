// Himalayas (himalayas.app) — large remote-jobs board, global. Clean JSON API
// (no LLM/Steel): /jobs/api?limit=N&offset=M returns { jobs, totalCount }. Zero
// seeding — surfaces roles from companies we never enrolled. Tune with HIMALAYAS_MAX_PAGES.
import { type AggregatorJob } from "./remoteok";
import { stripHtml, inferRemote } from "./util";

const PAGE_SIZE = 100;
const MAX_PAGES = Number(process.env.HIMALAYAS_MAX_PAGES || 20);

type HJob = {
  guid?: string | number;
  title?: string;
  companyName?: string;
  locationRestrictions?: string[];
  description?: string;
  pubDate?: number; // unix seconds
  applicationLink?: string;
};
type HPage = { jobs?: HJob[]; totalCount?: number };

export async function fetchHimalayasJobs(): Promise<AggregatorJob[]> {
  const out: AggregatorJob[] = [];
  const seen = new Set<string>();

  for (let page = 0; page < MAX_PAGES; page++) {
    let data: HPage;
    try {
      const res = await fetch(`https://himalayas.app/jobs/api?limit=${PAGE_SIZE}&offset=${page * PAGE_SIZE}`, {
        headers: { "User-Agent": "SasaBot/1.0 (+https://usesasa.xyz)", Accept: "application/json" },
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) break;
      data = (await res.json()) as HPage;
    } catch {
      break;
    }
    const jobs = data.jobs ?? [];
    if (jobs.length === 0) break;

    for (const j of jobs) {
      const id = j.guid != null ? String(j.guid) : j.applicationLink || "";
      if (!id || !j.title || seen.has(id)) continue;
      seen.add(id);
      const loc = (j.locationRestrictions ?? []).filter(Boolean).join(", ");
      out.push({
        company: (j.companyName || "Himalayas").slice(0, 120),
        externalId: `himalayas-${id}`,
        title: j.title.slice(0, 200),
        url: j.applicationLink || "",
        location: loc || "Remote",
        remotePolicy: inferRemote(loc, true), // Himalayas is a remote-only board
        postedAt: j.pubDate ? new Date(j.pubDate * 1000) : null,
        rawJd: j.description ? stripHtml(j.description).slice(0, 8000) : "",
      });
    }

    if (jobs.length < PAGE_SIZE) break; // last page
    if (data.totalCount && (page + 1) * PAGE_SIZE >= data.totalCount) break;
  }
  return out;
}
