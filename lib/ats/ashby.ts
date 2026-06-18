// Ashby public job-board API. No auth required for public boards.
// https://api.ashbyhq.com/posting-api/job-board/<slug>
import { type NormalizedJob, stripHtml, inferRemote } from "./util";

type AshbyJob = {
  id: string;
  title?: string;
  location?: string;
  isRemote?: boolean;
  employmentType?: string;
  descriptionPlain?: string;
  descriptionHtml?: string;
  publishedAt?: string;
  jobUrl?: string;
  isListed?: boolean;
};

export async function fetchAshbyJobs(slug: string): Promise<NormalizedJob[]> {
  const res = await fetch(
    `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(slug)}?includeCompensation=false`,
    { headers: { Accept: "application/json" } },
  );
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`Ashby ${slug}: HTTP ${res.status}`);

  const data = (await res.json()) as { jobs?: AshbyJob[] };
  return (data.jobs ?? [])
    .filter((j) => j.isListed !== false)
    .map((j) => {
      const location = j.location ?? "";
      const jd = j.descriptionPlain ?? (j.descriptionHtml ? stripHtml(j.descriptionHtml) : "");
      return {
        externalId: String(j.id),
        title: j.title ?? "",
        location,
        remotePolicy: inferRemote(location, j.isRemote),
        postedAt: j.publishedAt ? new Date(j.publishedAt) : null,
        rawJd: jd.slice(0, 8000),
        url: j.jobUrl ?? "",
      };
    });
}
