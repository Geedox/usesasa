// Jobberman (Nigeria/Ghana) — no public API, so we paginate its listing and use an
// LLM to extract the postings. We pull ALL roles (not just internships) across pages.
// Tune with JOBBERMAN_BASE and JOBBERMAN_MAX_PAGES.
import { createHash } from "node:crypto";
import { type AggregatorJob } from "./remoteok";
import { inferRemote } from "./util";
import { extractListing } from "./listing";

const BASE = process.env.JOBBERMAN_BASE || "https://www.jobberman.com/jobs";
const MAX_PAGES = Number(process.env.JOBBERMAN_MAX_PAGES || 8);

function id(s: string): string {
  return createHash("sha1").update(s).digest("hex").slice(0, 16);
}

export async function fetchJobbermanJobs(): Promise<AggregatorJob[]> {
  const out: AggregatorJob[] = [];
  const seen = new Set<string>();
  for (let page = 1; page <= MAX_PAGES; page++) {
    const url = page === 1 ? BASE : `${BASE}?page=${page}`;
    let added = 0;
    for (const j of await extractListing(url)) {
      if (seen.has(j.url)) continue;
      seen.add(j.url);
      added++;
      out.push({
        company: (j.company || "Jobberman").slice(0, 120),
        externalId: `jobberman-${id(j.url)}`,
        title: j.title.slice(0, 200),
        url: j.url,
        location: j.location || "Nigeria",
        remotePolicy: inferRemote(j.location || ""),
        postedAt: null,
        rawJd: "",
      });
    }
    if (added === 0) break; // reached the end (no new postings)
  }
  return out;
}
