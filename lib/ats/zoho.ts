// Zoho Recruit career sites are fully JS-rendered (Zoho's Lyte/Crux framework) and
// the official jobs API is OAuth-gated, so — unlike the clean-API ATS — we render the
// public careers page in a headless Steel browser and read the job links from the DOM.
// NOTE: each crawl spends a Steel session, so Zoho companies cost more than the
// JSON-API ATS. Returns [] gracefully when STEEL_API_KEY is unset.
import Steel from "steel-sdk";
import { chromium, type Browser } from "playwright";
import { type NormalizedJob, inferRemote } from "./util";

// slug = the full career-site host ("acme.zohorecruit.com" / regional .in/.eu) or a
// bare subdomain (defaults to .zohorecruit.com).
function hostFor(slug: string): string {
  return /zohorecruit\./i.test(slug) ? slug.replace(/^https?:\/\//, "").replace(/\/.*$/, "") : `${slug}.zohorecruit.com`;
}

export async function fetchZohoJobs(slug: string): Promise<NormalizedJob[]> {
  const apiKey = process.env.STEEL_API_KEY;
  if (!apiKey) return []; // rendering needs Steel
  const host = hostFor(slug);
  const url = `https://${host}/jobs/Careers`;

  const client = new Steel({ steelAPIKey: apiKey });
  let session: { id: string; websocketUrl: string } | null = null;
  let browser: Browser | null = null;
  try {
    session = (await client.sessions.create({ timeout: 120000 })) as unknown as { id: string; websocketUrl: string };
    browser = await chromium.connectOverCDP(`${session.websocketUrl}&apiKey=${apiKey}`);
    const context = browser.contexts()[0] ?? (await browser.newContext());
    const page = context.pages()[0] ?? (await context.newPage());
    page.setDefaultTimeout(45000);

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
    // Wait for the rendered job list; tolerate sites with zero openings.
    await page.waitForSelector('a[href*="/jobs/Careers/"]', { timeout: 20000 }).catch(() => {});

    const raw = await page.$$eval('a[href*="/jobs/Careers/"]', (els) =>
      els.map((a) => ({ href: (a as HTMLAnchorElement).href, text: (a.textContent || "").replace(/\s+/g, " ").trim() })),
    );

    const seen = new Set<string>();
    const jobs: NormalizedJob[] = [];
    for (const { href, text } of raw) {
      const m = href.match(/\/jobs\/Careers\/(\d+)/i);
      if (!m || !text || seen.has(m[1])) continue;
      seen.add(m[1]);
      jobs.push({
        externalId: `zoho-${m[1]}`,
        title: text.slice(0, 200),
        location: "",
        remotePolicy: inferRemote(text),
        postedAt: null,
        rawJd: "",
        url: href,
      });
    }
    return jobs;
  } catch (err) {
    console.error(`[zoho] ${host} error:`, String(err).slice(0, 160));
    return [];
  } finally {
    await browser?.close().catch(() => {});
    if (session?.id) await client.sessions.release(session.id).catch(() => {});
  }
}
