import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getSession } from "@/lib/get-session";
import { db } from "@/lib/db";
import { companies, type Ats } from "@/lib/db/schema";
import { parseJobUrl } from "@/lib/ats/parse-url";
import { detectAts } from "@/lib/ats/detect";
import { crawlCompany } from "@/lib/discovery/crawl";
import { enqueueScoreUser } from "@/lib/queue";

// "Add your own career page to watch": paste ANY careers/job link. We resolve what
// is behind it, in order:
//   1) a direct ATS URL (fast path),
//   2) a custom page that EMBEDS a known ATS (detector follows + scans),
//   3) a fully custom, non-ATS page -> the "custom" pipeline (LLM extracts the
//      postings; the Steel cloud browser applies to them).
// Then we add it to the watched set, crawl it now, and score it for this user.
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const { url } = (await req.json().catch(() => ({}))) as { url?: string };
  if (!url || !/^https?:\/\//i.test(url.trim())) return NextResponse.json({ error: "Paste a full careers or job link (https://…)." }, { status: 400 });
  const link = url.trim();

  let ats: Ats;
  let slug: string;
  let name: string;

  const parsed = parseJobUrl(link);
  if (parsed) {
    ats = parsed.ats;
    slug = parsed.slug;
    name = parsed.slug;
  } else {
    const d = await detectAts(link);
    if (d.kind === "aggregator") {
      return NextResponse.json({ error: "That looks like a job aggregator, not a single company's careers page. Paste a specific company's careers link." }, { status: 422 });
    }
    if (d.kind === "ats" && d.ats && d.slug) {
      ats = d.ats as Ats;
      slug = d.slug;
      name = d.slug;
    } else {
      // No known ATS — watch it as a custom page (slug = the URL itself).
      ats = "custom";
      slug = link;
      try { name = new URL(link).hostname.replace(/^www\./, ""); } catch { name = link.slice(0, 60); }
    }
  }

  // For a custom page we can at least use the site's favicon as the logo.
  let logoUrl: string | undefined;
  if (ats === "custom") {
    try { logoUrl = `https://www.google.com/s2/favicons?domain=${new URL(link).hostname}&sz=128`; } catch { /* no logo */ }
  }

  // Add to the watched set (idempotent), resolve the company id.
  await db
    .insert(companies)
    .values({ name, ats, atsSlug: slug, logoUrl })
    .onConflictDoNothing({ target: [companies.ats, companies.atsSlug] });
  const company = await db.query.companies.findFirst({ where: and(eq(companies.ats, ats), eq(companies.atsSlug, slug)) });
  if (!company) return NextResponse.json({ error: "Could not add that company." }, { status: 500 });

  // Crawl now so the roles are in the DB, then score for this user.
  const count = await crawlCompany(company.id, slug, ats);
  if (count === 0) {
    return NextResponse.json(
      { error: ats === "custom" ? "We opened that page but could not find any open roles on it. Make sure it lists current openings." : "That board has no open postings we can read right now." },
      { status: 422 },
    );
  }
  await enqueueScoreUser({ userId: session.user.id }, 2);

  return NextResponse.json({ ok: true, company: company.name, postings: count, custom: ats === "custom" });
}
