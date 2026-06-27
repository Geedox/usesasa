// BrighterMonday (Ringier) — East Africa job board (Kenya default; set BRIGHTERMONDAY_BASE
// to the .co.ug / .co.tz site). No public API, so we paginate the listing and use the
// shared LLM extractor. ALL roles, not just one category.
import { createHash } from "node:crypto";
import { type AggregatorJob } from "./remoteok";
import { inferRemote } from "./util";
import { extractListing } from "./listing";

const BASE = process.env.BRIGHTERMONDAY_BASE || "https://www.brightermonday.co.ke/jobs";
const MAX_PAGES = Number(process.env.BRIGHTERMONDAY_MAX_PAGES || 5);

function id(s: string): string {
  return createHash("sha1").update(s).digest("hex").slice(0, 16);
}

export async function fetchBrighterMondayJobs(): Promise<AggregatorJob[]> {
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
        company: (j.company || "BrighterMonday").slice(0, 120),
        externalId: `brightermonday-${id(j.url)}`,
        title: j.title.slice(0, 200),
        url: j.url,
        location: j.location || "Kenya",
        remotePolicy: inferRemote(j.location || ""),
        postedAt: null,
        rawJd: "",
      });
    }
    if (added === 0) break; // reached the end (no new postings)
  }
  return out;
}
