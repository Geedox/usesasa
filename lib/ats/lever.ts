// Lever public postings API. No auth required.
// https://api.lever.co/v0/postings/<slug>?mode=json
import { type NormalizedJob, stripHtml, inferRemote } from "./util";

type LeverPosting = {
  id: string;
  text?: string;
  categories?: { location?: string; commitment?: string; team?: string };
  descriptionPlain?: string;
  description?: string;
  hostedUrl?: string;
  createdAt?: number;
};

export async function fetchLeverJobs(slug: string): Promise<NormalizedJob[]> {
  const res = await fetch(`https://api.lever.co/v0/postings/${encodeURIComponent(slug)}?mode=json`, {
    headers: { Accept: "application/json" },
  });
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`Lever ${slug}: HTTP ${res.status}`);

  const data = (await res.json()) as LeverPosting[];
  return (Array.isArray(data) ? data : []).map((j) => {
    const location = j.categories?.location ?? "";
    const jd = j.descriptionPlain ?? (j.description ? stripHtml(j.description) : "");
    return {
      externalId: String(j.id),
      title: j.text ?? "",
      location,
      remotePolicy: inferRemote(location),
      postedAt: j.createdAt ? new Date(j.createdAt) : null,
      rawJd: jd.slice(0, 8000),
      url: j.hostedUrl ?? "",
    };
  });
}
