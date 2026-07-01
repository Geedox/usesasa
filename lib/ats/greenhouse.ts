// Greenhouse public job-board API client. No auth required.
// https://boards-api.greenhouse.io/v1/boards/<slug>/jobs?content=true
import { type NormalizedJob, stripHtml, inferRemote } from "./util";

type GreenhouseJob = {
  id: number;
  title: string;
  updated_at?: string;
  location?: { name?: string };
  content?: string;
  absolute_url?: string;
};

export async function fetchGreenhouseJobs(slug: string): Promise<NormalizedJob[]> {
  const res = await fetch(
    `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(slug)}/jobs?content=true`,
    { headers: { Accept: "application/json" } },
  );
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`Greenhouse ${slug}: HTTP ${res.status}`);

  const data = (await res.json()) as { jobs?: GreenhouseJob[] };
  return (data.jobs ?? []).map((j) => {
    const location = j.location?.name ?? "";
    return {
      externalId: String(j.id),
      title: j.title ?? "",
      location,
      remotePolicy: inferRemote(location),
      postedAt: j.updated_at ? new Date(j.updated_at) : null,
      rawJd: j.content ? stripHtml(j.content).slice(0, 8000) : "",
      url: j.absolute_url ?? "",
    };
  });
}
