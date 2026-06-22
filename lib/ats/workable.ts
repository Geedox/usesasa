// Workable public job-board widget API. No auth required.
// https://apply.workable.com/api/v1/widget/accounts/<account>?details=true
import { type NormalizedJob, stripHtml, inferRemote } from "./util";

type WorkableJob = {
  title?: string;
  shortcode?: string;
  url?: string;
  application_url?: string;
  telecommuting?: boolean;
  city?: string;
  state?: string;
  country?: string;
  published_on?: string;
  created_at?: string;
  description?: string;
};

export async function fetchWorkableJobs(slug: string): Promise<NormalizedJob[]> {
  const res = await fetch(`https://apply.workable.com/api/v1/widget/accounts/${encodeURIComponent(slug)}?details=true`, {
    headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0" },
  });
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`Workable ${slug}: HTTP ${res.status}`);

  const data = (await res.json()) as { jobs?: WorkableJob[] };
  return (data.jobs ?? [])
    .filter((j) => j.shortcode)
    .map((j) => {
      const location = [j.city, j.state, j.country].filter(Boolean).join(", ");
      const posted = j.published_on || j.created_at;
      return {
        externalId: j.shortcode!,
        title: j.title ?? "",
        location,
        remotePolicy: inferRemote(location, j.telecommuting),
        postedAt: posted ? new Date(posted) : null,
        rawJd: j.description ? stripHtml(j.description).slice(0, 8000) : "",
        // Posting page; the apply form lives at /apply (handled by applyUrlFor).
        url: j.url ?? `https://apply.workable.com/j/${j.shortcode}`,
      };
    });
}
