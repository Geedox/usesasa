// BambooHR public careers API. No auth required.
// https://<account>.bamboohr.com/careers/list -> { result: [...] }  (list, no JD)
// https://<account>.bamboohr.com/careers/<id>/detail -> { result: { jobOpening } }
import { type NormalizedJob, stripHtml, inferRemote } from "./util";

const MAX_DETAIL = 60; // cap per-job JD fetches per crawl

type Listed = {
  id?: number | string;
  jobOpeningName?: string;
  location?: { city?: string; state?: string };
  atsLocation?: { country?: string; state?: string; city?: string };
  isRemote?: boolean;
  locationType?: string;
};

export async function fetchBambooHrJobs(slug: string): Promise<NormalizedJob[]> {
  const res = await fetch(`https://${encodeURIComponent(slug)}.bamboohr.com/careers/list`, {
    headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0" },
  });
  if (!res.ok) return [];
  const data = (await res.json().catch(() => ({}))) as { result?: Listed[] };
  const listed = (data.result ?? []).filter((j) => j.id);

  const out: NormalizedJob[] = [];
  for (let i = 0; i < listed.length; i++) {
    const j = listed[i];
    const loc = [j.location?.city || j.atsLocation?.city, j.location?.state || j.atsLocation?.state, j.atsLocation?.country]
      .filter(Boolean)
      .join(", ");
    let rawJd = "";
    if (i < MAX_DETAIL) {
      try {
        const d = await fetch(`https://${slug}.bamboohr.com/careers/${j.id}/detail`, { headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0" } });
        if (d.ok) {
          const dj = (await d.json()) as { result?: { jobOpening?: { description?: string } } };
          const desc = dj.result?.jobOpening?.description;
          if (desc) rawJd = stripHtml(desc).slice(0, 8000);
        }
      } catch {
        /* JD is optional */
      }
    }
    out.push({
      externalId: String(j.id),
      title: j.jobOpeningName ?? "",
      location: loc,
      remotePolicy: inferRemote(loc, j.isRemote ?? /remote/i.test(j.locationType ?? "")),
      postedAt: null,
      rawJd,
      url: `https://${slug}.bamboohr.com/careers/${j.id}`,
    });
  }
  return out;
}
