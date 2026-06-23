// ATS auto-detector. Given a career-page or job URL, follow redirects and inspect
// the final URL + page HTML to classify which ATS backs it (and extract the
// account slug). Custom pages often EMBED an ATS via iframe/script, so we scan the
// HTML too. Output buckets the list into supported-ATS / aggregator / unknown so a
// big list (e.g. Nigerian/African career pages) can be wired data-driven.

export type DetectedAts =
  | "greenhouse" | "lever" | "ashby" | "smartrecruiters" | "workday" | "workable"
  | "recruitee" | "teamtailor" | "bamboohr" | "breezy" | "personio" | "gem" | "zoho";

export type Detection = {
  url: string;
  finalUrl: string;
  kind: "ats" | "aggregator" | "unknown" | "error";
  ats?: DetectedAts;
  slug?: string; // account/board slug for the fetcher
  note?: string;
};

// Known job aggregators (discovery sources, not direct-submit). Matched against the
// final URL host only — NOT page HTML (company pages link to LinkedIn/Indeed in
// footers, which would cause false positives).
const AGGREGATORS = /(jobberman|myjobmag|hotnigerianjobs|ngcareers|jobgurus|brightermonday|fuzu|jooble|naukri|careerjet|joblistnigeria|naijajobportal|jobsinnigeria|nigeriajob|recruit\.net|prosple|grabjobs|jobgether|himalayas\.app|dailyremote|rubyonremote|remote4africa|startup\.jobs|wise\.jobs|efinancialcareers|crossover\.com|arc\.dev|meetfrank|profdir|jobslin|nelajobs|my360career|techcabal)/i;

// Generic subdomains that are never the account slug.
const GENERIC = new Set(["www", "apply", "jobs", "careers", "career", "app", "api", "secure", "my", "boards", "job-boards"]);

// Extract an ATS + clean account slug from a blob of text (a URL or page HTML).
// Slug chars are restricted so an embedded match never swallows trailing HTML.
function matchSignatures(text: string): { ats: DetectedAts; slug?: string } | null {
  const path = (re: RegExp, ats: DetectedAts): { ats: DetectedAts; slug?: string } | null => {
    const m = text.match(re);
    return m && m[1] && !GENERIC.has(m[1].toLowerCase()) ? { ats, slug: m[1] } : null;
  };
  const sub = (re: RegExp, ats: DetectedAts): { ats: DetectedAts; slug?: string } | null => {
    const m = text.match(re);
    return m && m[1] && !GENERIC.has(m[1].toLowerCase()) ? { ats, slug: m[1].toLowerCase() } : null;
  };

  return (
    path(/(?:job-boards|boards)\.greenhouse\.io\/([a-z0-9_-]+)/i, "greenhouse") ||
    path(/boards-api\.greenhouse\.io\/v1\/boards\/([a-z0-9_-]+)/i, "greenhouse") ||
    path(/jobs\.lever\.co\/([a-z0-9_-]+)/i, "lever") ||
    path(/jobs\.ashbyhq\.com\/([a-z0-9_-]+)/i, "ashby") ||
    path(/api\.ashbyhq\.com\/posting-api\/job-board\/([a-z0-9_-]+)/i, "ashby") ||
    path(/apply\.workable\.com\/([a-z0-9_-]+)/i, "workable") ||
    sub(/([a-z0-9-]+)\.workable\.com/i, "workable") ||
    path(/(?:jobs|careers)\.smartrecruiters\.com\/([a-z0-9_-]+)/i, "smartrecruiters") ||
    sub(/([a-z0-9-]+)\.recruitee\.com/i, "recruitee") ||
    sub(/([a-z0-9-]+)\.teamtailor\.com/i, "teamtailor") ||
    sub(/([a-z0-9-]+)\.bamboohr\.com/i, "bamboohr") ||
    sub(/([a-z0-9-]+)\.breezy\.hr/i, "breezy") ||
    path(/([a-z0-9-]+)\.jobs\.personio\.com/i, "personio") ||
    path(/jobs\.gem\.com\/([a-z0-9_-]+)/i, "gem") ||
    (() => {
      // Zoho Recruit: keep the full career-site host as the slug (regional TLDs vary).
      const m = text.match(/([a-z0-9-]+\.zohorecruit\.(?:com|in|eu|jp|sa|uk|com\.au|com\.cn))/i);
      if (!m) return null;
      const sub = m[1].split(".")[0].toLowerCase();
      if (GENERIC.has(sub)) return null;
      return { ats: "zoho" as DetectedAts, slug: m[1].toLowerCase() };
    })() ||
    (() => {
      // Workday: capture tenant + host (+ best-effort site path) -> "tenant|host|site".
      const m = text.match(/([a-z0-9-]+)\.(wd\d+\.myworkdayjobs\.com)(?:\/(?:[a-z]{2}-[A-Z]{2}\/)?([A-Za-z0-9_]+))?/i);
      if (!m) return null;
      const tenant = m[1].toLowerCase();
      const site = m[3] && !/^job$/i.test(m[3]) ? m[3] : "";
      return { ats: "workday" as DetectedAts, slug: `${tenant}|${tenant}.${m[2]}|${site}` };
    })()
  );
}

export async function detectAts(url: string): Promise<Detection> {
  let finalUrl = url;
  try {
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0", Accept: "text/html" }, redirect: "follow", signal: AbortSignal.timeout(12000) });
    finalUrl = res.url || url;

    // 1) Did we land on (or redirect to) a known ATS host?
    const byUrl = matchSignatures(finalUrl);
    if (byUrl) return { url, finalUrl, kind: "ats", ...byUrl };

    if (AGGREGATORS.test(finalUrl)) return { url, finalUrl, kind: "aggregator", note: "aggregator board" };

    // 2) Custom page — does it EMBED an ATS (iframe/script/link to an ATS host)?
    const html = (await res.text()).slice(0, 600_000);
    const byHtml = matchSignatures(html);
    if (byHtml) return { url, finalUrl, kind: "ats", note: "embedded ATS", ...byHtml };

    return { url, finalUrl, kind: "unknown", note: "custom or unrecognized career page" };
  } catch (e) {
    return { url, finalUrl, kind: "error", note: String(e).slice(0, 120) };
  }
}

// Classify a whole list and bucket it. Runs with limited concurrency so a big
// list stays polite.
export async function detectMany(urls: string[], concurrency = 6): Promise<Detection[]> {
  const out: Detection[] = [];
  let i = 0;
  async function worker() {
    while (i < urls.length) {
      const u = urls[i++];
      out.push(await detectAts(u.trim()));
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, urls.length) }, worker));
  return out;
}
