// Workday public CXS API. No auth for browsing jobs.
// A Workday "slug" here encodes the tenant, host and site as "tenant|host|site"
// (Workday needs all three, unlike a single board slug).
//   e.g. "nvidia|nvidia.wd5.myworkdayjobs.com|NVIDIAExternalCareerSite"
import { type NormalizedJob, stripHtml, inferRemote } from "./util";

const MAX_JOBS = 20; // Workday CXS caps `limit` at 20; each job also needs a detail fetch

type Posting = { title?: string; externalPath?: string; locationsText?: string; postedOn?: string; bulletFields?: string[] };

function parsePostedOn(s?: string): Date | null {
  if (!s) return null;
  if (/today/i.test(s)) return new Date();
  const m = s.match(/(\d+)\+?\s*day/i);
  if (m) return new Date(Date.now() - Number(m[1]) * 86400000);
  const w = s.match(/(\d+)\+?\s*week/i);
  if (w) return new Date(Date.now() - Number(w[1]) * 7 * 86400000);
  return null;
}

export async function fetchWorkdayJobs(slug: string): Promise<NormalizedJob[]> {
  const [tenant, host, site] = slug.split("|");
  if (!tenant || !host || !site) return [];
  const cxs = `https://${host}/wday/cxs/${tenant}/${site}`;

  const listRes = await fetch(`${cxs}/jobs`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ limit: MAX_JOBS, offset: 0, searchText: "", appliedFacets: {} }),
  });
  if (!listRes.ok) {
    if (listRes.status === 404) return [];
    throw new Error(`Workday ${tenant}: HTTP ${listRes.status}`);
  }
  const data = (await listRes.json()) as { jobPostings?: Posting[] };
  const postings = (data.jobPostings ?? []).filter((p) => p.externalPath);

  const out: NormalizedJob[] = [];
  for (const p of postings) {
    const externalId = p.bulletFields?.[0] || (p.externalPath ?? "").split("_").pop() || (p.externalPath ?? "");
    const location = p.locationsText ?? "";
    let rawJd = "";
    try {
      const detail = await fetch(`${cxs}${p.externalPath}`, { headers: { Accept: "application/json" } });
      if (detail.ok) {
        const dj = (await detail.json()) as { jobPostingInfo?: { jobDescription?: string } };
        rawJd = dj.jobPostingInfo?.jobDescription ? stripHtml(dj.jobPostingInfo.jobDescription).slice(0, 8000) : "";
      }
    } catch {
      /* description optional */
    }
    out.push({
      externalId: String(externalId),
      title: p.title ?? "",
      location,
      remotePolicy: inferRemote(location),
      postedAt: parsePostedOn(p.postedOn),
      rawJd,
      // Public posting URL; the apply form lives at /apply/applyManually behind login.
      url: `https://${host}/en-US/${site}${p.externalPath}`,
    });
  }
  return out;
}
