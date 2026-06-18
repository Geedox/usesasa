// SmartRecruiters public Posting API (per company). No auth.
// https://api.smartrecruiters.com/v1/companies/<identifier>/postings?limit=100&offset=0
// Note: the postings list has no full JD (that needs a per-posting detail call), so we
// compose a summary from the listing fields. Full JD can be fetched on demand at apply time.
import { type NormalizedJob } from "./util";

const MAX = 200; // cap postings per company per crawl

type SRLabeled = { label?: string };
type SRPosting = {
  id: string;
  name?: string;
  releasedDate?: string;
  location?: { city?: string; country?: string; remote?: boolean; hybrid?: boolean; fullLocation?: string };
  function?: SRLabeled;
  department?: SRLabeled;
  experienceLevel?: SRLabeled;
  typeOfEmployment?: SRLabeled;
};

export async function fetchSmartRecruitersJobs(identifier: string): Promise<NormalizedJob[]> {
  const out: NormalizedJob[] = [];
  for (let offset = 0; offset < MAX; offset += 100) {
    const res = await fetch(
      `https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(identifier)}/postings?limit=100&offset=${offset}`,
      { headers: { Accept: "application/json" } },
    );
    if (res.status === 404) break;
    if (!res.ok) throw new Error(`SmartRecruiters ${identifier}: HTTP ${res.status}`);
    const data = (await res.json()) as { content?: SRPosting[]; totalFound?: number };
    const content = data.content ?? [];
    if (content.length === 0) break;

    for (const p of content) {
      const loc = p.location;
      const locStr = loc?.fullLocation || [loc?.city, loc?.country].filter(Boolean).join(", ") || "";
      const summary = [p.name, p.function?.label, p.department?.label, p.experienceLevel?.label, p.typeOfEmployment?.label]
        .filter(Boolean)
        .join(" · ");
      out.push({
        externalId: String(p.id),
        title: p.name ?? "",
        location: locStr,
        remotePolicy: loc?.remote ? "remote" : loc?.hybrid ? "hybrid" : locStr ? "onsite" : null,
        postedAt: p.releasedDate ? new Date(p.releasedDate) : null,
        rawJd: summary,
        url: `https://jobs.smartrecruiters.com/${identifier}/${p.id}`,
      });
    }
    if (content.length < 100) break;
  }
  return out;
}
