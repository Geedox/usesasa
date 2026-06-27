// Pinpoint (pinpointhq.com) — per-company ATS. Clean public JSON, no auth:
// https://<account>.pinpointhq.com/postings.json -> { data: [...] }.
import { type NormalizedJob, stripHtml, inferRemote } from "./util";

type Loc = { city?: string | null; name?: string | null; province?: string | null };
type Posting = {
  id?: string | number;
  title?: string;
  description?: string;
  url?: string;
  location?: Loc;
  workplace_type?: string;
  remote?: boolean;
  created_at?: string;
  published_at?: string;
};

function hostFor(slug: string): string {
  return /pinpointhq\./i.test(slug)
    ? slug.replace(/^https?:\/\//, "").replace(/\/.*$/, "")
    : `${slug}.pinpointhq.com`;
}

export async function fetchPinpointJobs(slug: string): Promise<NormalizedJob[]> {
  const host = hostFor(slug);
  const res = await fetch(`https://${host}/postings.json`, {
    headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0" },
    signal: AbortSignal.timeout(15000),
  });
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`Pinpoint ${host}: HTTP ${res.status}`);

  const data = ((await res.json()) as { data?: Posting[] }).data ?? [];
  return data
    .filter((p) => p.id != null && p.title)
    .map((p) => {
      const loc = p.location ?? {};
      const city = loc.city || "";
      const region = loc.province && loc.province !== loc.city ? `, ${loc.province}` : "";
      const location = (city + region) || loc.name || "";
      const isRemote = /remote/i.test(loc.name || "") || /remote/i.test(p.workplace_type || "") || p.remote === true;
      const posted = p.created_at || p.published_at;
      return {
        externalId: `pinpoint-${p.id}`,
        title: (p.title as string).slice(0, 200),
        location,
        remotePolicy: inferRemote(location, isRemote),
        postedAt: posted ? new Date(posted) : null,
        rawJd: p.description ? stripHtml(p.description).slice(0, 8000) : "",
        url: p.url || `https://${host}/postings/${p.id}`,
      };
    });
}
