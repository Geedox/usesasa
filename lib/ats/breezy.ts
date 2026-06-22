// Breezy HR public board. No auth required.
// https://<account>.breezy.hr/json -> [ { id, name, url, location{...}, ... } ]
import { type NormalizedJob, inferRemote } from "./util";

type BreezyPos = {
  id?: string;
  name?: string;
  url?: string;
  published_date?: string;
  location?: { name?: string; is_remote?: boolean };
};

export async function fetchBreezyJobs(slug: string): Promise<NormalizedJob[]> {
  const res = await fetch(`https://${encodeURIComponent(slug)}.breezy.hr/json`, {
    headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0" },
  });
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`Breezy ${slug}: HTTP ${res.status}`);

  const data = (await res.json().catch(() => [])) as BreezyPos[];
  if (!Array.isArray(data)) return [];
  return data
    .filter((p) => p.id)
    .map((p) => {
      const loc = p.location?.name ?? "";
      return {
        externalId: String(p.id),
        title: p.name ?? "",
        location: loc,
        remotePolicy: inferRemote(loc, p.location?.is_remote),
        postedAt: p.published_date ? new Date(p.published_date) : null,
        rawJd: "",
        url: p.url ?? `https://${slug}.breezy.hr/p/${p.id}`,
      };
    });
}
