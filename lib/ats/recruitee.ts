// Recruitee public offers API. No auth required.
// https://<account>.recruitee.com/api/offers/ -> { offers: [...] }
import { type NormalizedJob, stripHtml, inferRemote } from "./util";

type Offer = {
  id?: number | string;
  title?: string;
  careers_url?: string;
  careers_apply_url?: string;
  location?: string;
  remote?: boolean;
  created_at?: string;
  published_at?: string;
  description?: string;
};

export async function fetchRecruiteeJobs(slug: string): Promise<NormalizedJob[]> {
  const res = await fetch(`https://${encodeURIComponent(slug)}.recruitee.com/api/offers/`, {
    headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0" },
  });
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`Recruitee ${slug}: HTTP ${res.status}`);

  const data = (await res.json()) as { offers?: Offer[] };
  return (data.offers ?? [])
    .filter((o) => o.id)
    .map((o) => {
      const posted = o.published_at || o.created_at;
      return {
        externalId: String(o.id),
        title: o.title ?? "",
        location: o.location ?? "",
        remotePolicy: inferRemote(o.location ?? "", o.remote),
        postedAt: posted ? new Date(posted) : null,
        rawJd: o.description ? stripHtml(o.description).slice(0, 8000) : "",
        // careers_apply_url is the application form (".../c/new").
        url: o.careers_apply_url || o.careers_url || "",
      };
    });
}
