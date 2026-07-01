// Non-ATS custom career page pipeline. For pages with no known ATS API, we read
// the page (plain fetch; Steel-rendered fallback for JS/bot-protected pages), then
// use an LLM to extract the open job postings from whatever the layout is. The
// resulting jobs flow through the same matching + Steel-submission pipeline.
import Anthropic from "@anthropic-ai/sdk";
import { createHash } from "node:crypto";
import { type NormalizedJob, stripHtml, inferRemote } from "./util";

function stableId(s: string): string {
  return createHash("sha1").update(s).digest("hex").slice(0, 16);
}

// Collect <a href> with their anchor text — the LLM maps titles to apply/detail links.
function extractLinks(html: string, base: string): { text: string; href: string }[] {
  const out: { text: string; href: string }[] = [];
  const re = /<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  let n = 0;
  while ((m = re.exec(html)) && n < 400) {
    const text = stripHtml(m[2]).slice(0, 120);
    if (!text) continue;
    let href = m[1];
    try { href = new URL(href, base).toString(); } catch { continue; }
    if (!/^https?:/.test(href)) continue;
    out.push({ text, href });
    n++;
  }
  return out;
}

function looksLikeSpa(html: string, links: { text: string }[]): boolean {
  const jobish = links.filter((l) => /\b(engineer|developer|manager|designer|analyst|lead|officer|specialist|associate|intern|director|scientist|consultant|sales|marketing|product|operations|accountant|hr)\b/i.test(l.text)).length;
  if (jobish >= 2) return false;
  return /id="root"|id="__next"|__NEXT_DATA__|window\.__NUXT__|ng-version|data-reactroot/i.test(html) || stripHtml(html).length < 600;
}

// Render a JS page in a Steel cloud browser to get the post-JS HTML.
async function renderWithSteel(url: string): Promise<string | null> {
  const apiKey = process.env.STEEL_API_KEY;
  if (!apiKey) return null;
  const Steel = (await import("steel-sdk")).default;
  const { chromium } = await import("playwright");
  const client = new Steel({ steelAPIKey: apiKey });
  let session: { id: string; websocketUrl: string } | null = null;
  let browser: Awaited<ReturnType<typeof chromium.connectOverCDP>> | null = null;
  try {
    session = (await client.sessions.create({ blockAds: true, timeout: 120000 })) as unknown as { id: string; websocketUrl: string };
    browser = await chromium.connectOverCDP(`${session.websocketUrl}&apiKey=${apiKey}`);
    const ctx = browser.contexts()[0] ?? (await browser.newContext());
    const page = ctx.pages()[0] ?? (await ctx.newPage());
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(3500);
    return await page.content();
  } catch {
    return null;
  } finally {
    await browser?.close().catch(() => {});
    if (session?.id) await client.sessions.release(session.id).catch(() => {});
  }
}

type Extracted = { title: string; url: string; location?: string };

async function extractJobs(baseUrl: string, html: string): Promise<Extracted[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return [];
  const links = extractLinks(html, baseUrl);
  const text = stripHtml(html).slice(0, 12000);
  const linkList = links.slice(0, 150).map((l, i) => `[${i}] ${l.text} -> ${l.href}`).join("\n");

  const anthropic = new Anthropic({ apiKey });
  const msg = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2000,
    messages: [{
      role: "user",
      content: `This is a company's careers/jobs page. Extract the OPEN JOB POSTINGS only (not navigation, blog posts, or generic links).

For each posting return its title, the absolute URL to its detail/apply page (pick the matching link from the LINKS list), and location if shown.

Return ONLY JSON: {"jobs":[{"title":"...","url":"https://...","location":"..."}]}. If there are no real job postings, return {"jobs":[]}.

PAGE TEXT:
${text}

LINKS (use these exact URLs):
${linkList}`,
    }],
  });
  const part = msg.content.find((c) => c.type === "text");
  const raw = part && "text" in part ? part.text : "";
  try {
    const json = raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1);
    const parsed = JSON.parse(json) as { jobs?: Extracted[] };
    return (parsed.jobs ?? []).filter((j) => j.title && /^https?:/.test(j.url || ""));
  } catch {
    return [];
  }
}

export async function fetchCustomJobs(careersUrl: string): Promise<NormalizedJob[]> {
  let html = "";
  try {
    const res = await fetch(careersUrl, { headers: { "User-Agent": "Mozilla/5.0", Accept: "text/html" }, redirect: "follow", signal: AbortSignal.timeout(15000) });
    if (res.ok) html = await res.text();
  } catch { /* fall through to Steel */ }

  let jobs = html ? await extractJobs(careersUrl, html) : [];

  // JS-rendered or bot-blocked? Render in Steel and try again.
  if (jobs.length === 0 && (!html || looksLikeSpa(html, extractLinks(html, careersUrl)))) {
    const rendered = await renderWithSteel(careersUrl);
    if (rendered) jobs = await extractJobs(careersUrl, rendered);
  }

  return jobs.slice(0, 100).map((j) => ({
    externalId: stableId(j.url || j.title),
    title: j.title.slice(0, 200),
    location: j.location ?? "",
    remotePolicy: inferRemote(j.location ?? ""),
    postedAt: null,
    rawJd: "",
    url: j.url,
  }));
}
