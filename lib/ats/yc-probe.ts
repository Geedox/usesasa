// YC directory -> ATS prober. For each YC company, derive a slug from its domain
// and name, then probe the ATSes YC startups use (Ashby / Greenhouse / Lever /
// Workable) directly via their public APIs. Hits are real, winnable startup
// boards on ATSes we already submit to — no HTML scraping, no new fetchers.
import { readFileSync } from "node:fs";

type Co = { name?: string; slug?: string; website?: string; status?: string; small_logo_thumb_url?: string };
export type Hit = { ats: "ashby" | "greenhouse" | "lever" | "workable"; slug: string; name: string; jobs: number; logoUrl?: string };

const TIMEOUT = 10000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Fetch JSON, retrying on throttle/timeout (not on a genuine 404 miss), so a
// large scan does not silently lose hits when the ATS rate-limits us.
async function getJson(url: string): Promise<{ ok: boolean; data?: unknown; miss?: boolean }> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT), headers: { "User-Agent": "Mozilla/5.0" } });
      if (r.status === 404 || r.status === 410) return { ok: false, miss: true };
      if (r.status === 429 || r.status === 503 || r.status >= 500) { await sleep(1200 * (attempt + 1)); continue; }
      if (!r.ok) return { ok: false, miss: true };
      return { ok: true, data: await r.json() };
    } catch {
      await sleep(1000 * (attempt + 1)); // timeout / network — retry
    }
  }
  return { ok: false }; // exhausted retries (treat as unknown, not a confirmed miss)
}

const arrLen = (d: unknown): number | null => (Array.isArray(d) && d.length ? d.length : null);
const jobsLen = (d: unknown): number | null => arrLen((d as { jobs?: unknown[] })?.jobs);

function candidates(co: Co): string[] {
  const out = new Set<string>();
  try {
    const host = new URL(co.website!).hostname.replace(/^www\./, "");
    const root = host.split(".")[0];
    if (root && root.length >= 2) out.add(root.toLowerCase());
  } catch { /* no/invalid website */ }
  if (co.slug && co.slug.length >= 2) out.add(co.slug.toLowerCase());
  const n = (co.name ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  if (n.length >= 2) out.add(n);
  return [...out].slice(0, 2); // keep request volume sane
}

async function probeAshby(slug: string): Promise<number | null> {
  const r = await getJson(`https://api.ashbyhq.com/posting-api/job-board/${slug}`);
  return r.ok ? jobsLen(r.data) : null;
}
async function probeGreenhouse(slug: string): Promise<number | null> {
  const r = await getJson(`https://boards-api.greenhouse.io/v1/boards/${slug}/jobs`);
  return r.ok ? jobsLen(r.data) : null;
}
async function probeLever(slug: string): Promise<number | null> {
  const r = await getJson(`https://api.lever.co/v0/postings/${slug}?mode=json&limit=1`);
  return r.ok ? arrLen(r.data) : null;
}
async function probeWorkable(slug: string): Promise<number | null> {
  const r = await getJson(`https://apply.workable.com/api/v1/widget/accounts/${slug}?details=true`);
  return r.ok ? jobsLen(r.data) : null;
}

// First ATS hit for a company wins (a company is on one ATS).
async function probeCompany(co: Co): Promise<Hit | null> {
  for (const slug of candidates(co)) {
    const checks: [Hit["ats"], Promise<number | null>][] = [
      ["ashby", probeAshby(slug)],
      ["greenhouse", probeGreenhouse(slug)],
      ["lever", probeLever(slug)],
      ["workable", probeWorkable(slug)],
    ];
    const results = await Promise.all(checks.map(([, p]) => p));
    for (let i = 0; i < checks.length; i++) {
      if (results[i]) return { ats: checks[i][0], slug, name: co.name ?? slug, jobs: results[i]!, logoUrl: co.small_logo_thumb_url };
    }
  }
  return null;
}

export async function probeYc(jsonPath: string, opts: { limit?: number; concurrency?: number; activeOnly?: boolean } = {}): Promise<Hit[]> {
  const all = JSON.parse(readFileSync(jsonPath, "utf-8")) as Co[];
  let cos = all.filter((c) => c.website);
  if (opts.activeOnly) cos = cos.filter((c) => c.status === "Active");
  if (opts.limit) cos = cos.slice(0, opts.limit);

  const hits: Hit[] = [];
  let i = 0;
  let done = 0;
  const N = cos.length;
  const conc = opts.concurrency ?? 12;
  async function worker() {
    while (i < N) {
      const co = cos[i++];
      const hit = await probeCompany(co);
      done++;
      if (hit) { hits.push(hit); console.log(`  [${done}/${N}] HIT ${hit.ats}/${hit.slug} (${hit.jobs} jobs) — ${hit.name}`); }
      else if (done % 100 === 0) console.log(`  …${done}/${N} scanned, ${hits.length} hits so far`);
    }
  }
  await Promise.all(Array.from({ length: conc }, worker));
  return hits;
}
