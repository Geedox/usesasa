// Zoho Recruit career sites render with Zoho's Lyte/Crux framework, but the full job
// list is embedded in the page HTML as a JSON data island (HTML-entity encoded), so
// we can read it with a plain fetch, no headless browser and no auth. Same cost as the
// other JSON-API ATS. slug = the full career-site host ("acme.zohorecruit.com" /
// regional .in/.eu) or a bare subdomain (defaults to .zohorecruit.com).
import { type NormalizedJob, stripHtml, inferRemote } from "./util";

type ZohoJob = {
  id?: string;
  Posting_Title?: string;
  Job_Opening_Name?: string;
  City?: string | null;
  Country?: string | null;
  Remote_Job?: boolean;
  Date_Opened?: string;
  Job_Description?: string;
  Is_Locked?: boolean;
};

function hostFor(slug: string): string {
  return /zohorecruit\./i.test(slug)
    ? slug.replace(/^https?:\/\//, "").replace(/\/.*$/, "")
    : `${slug}.zohorecruit.com`;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&#34;/g, '"').replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'").replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&#38;/g, "&").replace(/&amp;/g, "&");
}

// Pull each embedded job object out of the decoded page by anchoring on the
// "Posting_Title" key and expanding to its balanced { } (string-aware, so HTML in
// Job_Description doesn't break it).
function extractJobObjects(html: string): ZohoJob[] {
  const d = decodeEntities(html);
  const KEY = '"Posting_Title"';
  const out: ZohoJob[] = [];
  let from = 0;
  while (true) {
    const k = d.indexOf(KEY, from);
    if (k === -1) break;
    let depth = 0, start = -1;
    for (let i = k - 1; i >= 0; i--) {
      const c = d[i];
      if (c === "}") depth++;
      else if (c === "{") { if (depth === 0) { start = i; break; } depth--; }
    }
    if (start === -1) { from = k + KEY.length; continue; }
    let dep = 0, end = -1, inStr = false, esc = false;
    for (let i = start; i < d.length; i++) {
      const c = d[i];
      if (inStr) { if (esc) esc = false; else if (c === "\\") esc = true; else if (c === '"') inStr = false; continue; }
      if (c === '"') inStr = true;
      else if (c === "{") dep++;
      else if (c === "}") { dep--; if (dep === 0) { end = i; break; } }
    }
    if (end === -1) { from = k + KEY.length; continue; }
    try { out.push(JSON.parse(d.slice(start, end + 1)) as ZohoJob); } catch { /* skip malformed */ }
    from = end + 1;
  }
  return out;
}

export async function fetchZohoJobs(slug: string): Promise<NormalizedJob[]> {
  const host = hostFor(slug);
  const res = await fetch(`https://${host}/jobs/Careers`, {
    headers: { "User-Agent": "Mozilla/5.0", Accept: "text/html" },
    redirect: "follow",
    signal: AbortSignal.timeout(20000),
  });
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`Zoho ${host}: HTTP ${res.status}`);

  const html = await res.text();
  const seen = new Set<string>();
  const jobs: NormalizedJob[] = [];
  for (const j of extractJobObjects(html)) {
    const id = j.id ? String(j.id) : "";
    const title = (j.Posting_Title || j.Job_Opening_Name || "").trim();
    if (!id || !title || seen.has(id)) continue;
    seen.add(id);
    const location = [j.City, j.Country].filter((p) => p && String(p).trim()).join(", ");
    const titleSlug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "job";
    jobs.push({
      externalId: `zoho-${id}`,
      title: title.slice(0, 200),
      location,
      remotePolicy: inferRemote(location, j.Remote_Job === true),
      postedAt: j.Date_Opened ? new Date(j.Date_Opened) : null,
      rawJd: j.Job_Description ? stripHtml(decodeEntities(j.Job_Description)).slice(0, 8000) : "",
      url: `https://${host}/jobs/Careers/${id}/${encodeURIComponent(titleSlug)}`,
    });
  }
  return jobs;
}
