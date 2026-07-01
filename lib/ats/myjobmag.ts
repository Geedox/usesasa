// MyJobMag (Nigeria + other African countries) — no clean RSS, so we paginate its
// listing and LLM-extract ALL postings (page 1 = /jobs, page N = /jobs/page/N).
// Tune with MYJOBMAG_BASE and MYJOBMAG_MAX_PAGES.
import { createHash } from "node:crypto";
import { type AggregatorJob } from "./remoteok";
import { inferRemote } from "./util";
import { extractListing } from "./listing";

const BASE = process.env.MYJOBMAG_BASE || "https://www.myjobmag.com/jobs";
const MAX_PAGES = Number(process.env.MYJOBMAG_MAX_PAGES || 8);

function id(s: string): string {
  return createHash("sha1").update(s).digest("hex").slice(0, 16);
}

export async function fetchMyJobMagJobs(): Promise<AggregatorJob[]> {
  const out: AggregatorJob[] = [];
  const seen = new Set<string>();
  for (let page = 1; page <= MAX_PAGES; page++) {
    const url = page === 1 ? BASE : `${BASE}/page/${page}`;
    let added = 0;
    for (const j of await extractListing(url)) {
      if (seen.has(j.url)) continue;
      seen.add(j.url);
      added++;
      out.push({
        company: (j.company || "MyJobMag").slice(0, 120),
        externalId: `myjobmag-${id(j.url)}`,
        title: j.title.slice(0, 200),
        url: j.url,
        location: j.location || "Nigeria",
        remotePolicy: inferRemote(j.location || ""),
        postedAt: null,
        rawJd: "",
      });
    }
    if (added === 0) break; // reached the end
  }
  return out;
}
