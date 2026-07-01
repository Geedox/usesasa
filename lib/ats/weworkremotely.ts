// We Work Remotely public RSS (aggregator). No auth. The single feed caps at ~100,
// so we pull all category feeds and dedupe for much broader coverage.
import { stripHtml } from "./util";
import type { AggregatorJob } from "./remoteok";

const FEEDS = [
  "https://weworkremotely.com/remote-jobs.rss",
  "https://weworkremotely.com/categories/remote-programming-jobs.rss",
  "https://weworkremotely.com/categories/remote-design-jobs.rss",
  "https://weworkremotely.com/categories/remote-devops-sysadmin-jobs.rss",
  "https://weworkremotely.com/categories/remote-customer-support-jobs.rss",
  "https://weworkremotely.com/categories/remote-sales-and-marketing-jobs.rss",
  "https://weworkremotely.com/categories/remote-product-jobs.rss",
  "https://weworkremotely.com/categories/remote-management-and-finance-jobs.rss",
];

function tag(block: string, name: string): string {
  const m = block.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`));
  if (!m) return "";
  return stripHtml(m[1].replace(/<!\[CDATA\[|\]\]>/g, ""));
}

function parseFeed(xml: string): AggregatorJob[] {
  return xml
    .split("<item>")
    .slice(1)
    .map((block) => {
      const title = tag(block, "title");
      const link = (block.match(/<link>([\s\S]*?)<\/link>/)?.[1] ?? "").trim();
      const region = tag(block, "region");
      const pub = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1]?.trim() ?? "";
      const desc = tag(block, "description");
      const [company, ...rest] = title.split(": ");
      const position = rest.join(": ") || title;
      const slug = link.split("/remote-jobs/")[1]?.replace(/\/$/, "") || link;
      return {
        company: company || "Unknown",
        externalId: slug,
        title: position,
        location: region || "Remote",
        remotePolicy: "remote",
        postedAt: pub ? new Date(pub) : null,
        rawJd: desc.slice(0, 8000),
        url: link,
      };
    })
    .filter((j) => j.externalId && j.title);
}

export async function fetchWeWorkRemotelyJobs(): Promise<AggregatorJob[]> {
  const settled = await Promise.allSettled(
    FEEDS.map(async (url) => {
      const res = await fetch(url, { headers: { "User-Agent": "SasaBot/1.0 (+https://usesasa.xyz)" } });
      if (!res.ok) return [] as AggregatorJob[];
      return parseFeed(await res.text());
    }),
  );

  const byId = new Map<string, AggregatorJob>();
  for (const s of settled) {
    if (s.status === "fulfilled") for (const j of s.value) if (!byId.has(j.externalId)) byId.set(j.externalId, j);
  }
  return [...byId.values()];
}
