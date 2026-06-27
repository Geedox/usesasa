// Remotive (remotive.com) — global remote jobs. Clean public JSON API, all in one
// call: /api/remote-jobs -> { jobs: [...] }. Zero seeding.
import { type AggregatorJob } from "./remoteok";
import { stripHtml, inferRemote } from "./util";

const LIMIT = Number(process.env.REMOTIVE_LIMIT || 500);

type RJob = {
  id?: number | string;
  url?: string;
  title?: string;
  company_name?: string;
  candidate_required_location?: string;
  publication_date?: string;
  description?: string;
};

export async function fetchRemotiveJobs(): Promise<AggregatorJob[]> {
  let jobs: RJob[] = [];
  try {
    const res = await fetch(`https://remotive.com/api/remote-jobs?limit=${LIMIT}`, {
      headers: { "User-Agent": "SasaBot/1.0 (+https://usesasa.xyz)", Accept: "application/json" },
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return [];
    jobs = ((await res.json()) as { jobs?: RJob[] }).jobs ?? [];
  } catch {
    return [];
  }

  const out: AggregatorJob[] = [];
  const seen = new Set<string>();
  for (const j of jobs) {
    if (j.id == null || !j.title) continue;
    const id = String(j.id);
    if (seen.has(id)) continue;
    seen.add(id);
    const loc = j.candidate_required_location || "";
    out.push({
      company: (j.company_name || "Remotive").slice(0, 120),
      externalId: `remotive-${id}`,
      title: j.title.slice(0, 200),
      url: j.url || "",
      location: loc || "Remote",
      remotePolicy: inferRemote(loc, true), // Remotive is a remote-only board
      postedAt: j.publication_date ? new Date(j.publication_date) : null,
      rawJd: j.description ? stripHtml(j.description).slice(0, 8000) : "",
    });
  }
  return out;
}
