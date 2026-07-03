// Shared LLM listing extractor for job-board pages with no clean API (Jobberman,
// MyJobMag, etc.). Fetches the listing HTML and asks an LLM for the postings.
import Anthropic from "@anthropic-ai/sdk";
import { logUsage } from "@/lib/anthropic-usage";
import { stripHtml } from "./util";

export type ListingJob = { title: string; url: string; company?: string; location?: string };

function extractLinks(html: string, base: string): { text: string; href: string }[] {
  const out: { text: string; href: string }[] = [];
  const re = /<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  let n = 0;
  while ((m = re.exec(html)) && n < 500) {
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

export async function extractListing(url: string): Promise<ListingJob[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return [];
  let html = "";
  try {
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0", Accept: "text/html" }, redirect: "follow", signal: AbortSignal.timeout(15000) });
    if (res.ok) html = await res.text();
  } catch {
    return [];
  }
  if (!html) return [];

  const links = extractLinks(html, url);
  const text = stripHtml(html).slice(0, 20000);
  const linkList = links.slice(0, 350).map((l, i) => `[${i}] ${l.text} -> ${l.href}`).join("\n");

  const anthropic = new Anthropic({ apiKey });
  const msg = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 5000,
    messages: [{
      role: "user",
      content: `This is a job board listing page. Extract the OPEN JOB POSTINGS only (skip nav, ads, blog, category and "jobs at X" links).

For each posting return: title, the absolute URL to its detail page (pick from the LINKS list), the hiring company name if shown, and location if shown.

Return ONLY JSON: {"jobs":[{"title":"...","url":"https://...","company":"...","location":"..."}]}. If none, {"jobs":[]}.

PAGE TEXT:
${text}

LINKS:
${linkList}`,
    }],
  });
  logUsage("discovery.listing_extract", msg);
  const part = msg.content.find((c) => c.type === "text");
  const raw = part && "text" in part ? part.text : "";
  try {
    const json = raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1);
    return ((JSON.parse(json) as { jobs?: ListingJob[] }).jobs ?? []).filter((j) => j.title && /^https?:/.test(j.url || ""));
  } catch {
    return [];
  }
}
