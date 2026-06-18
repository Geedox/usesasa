import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getSession } from "@/lib/get-session";
import { db } from "@/lib/db";
import { companies } from "@/lib/db/schema";
import { parseJobUrl } from "@/lib/ats/parse-url";
import { crawlCompany } from "@/lib/discovery/crawl";
import { enqueueScoreUser } from "@/lib/queue";

// "Add your own": paste a Greenhouse/Lever/Ashby URL. We add that company to the
// watched set (helps everyone), crawl it now, and score it for this user.
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const { url } = (await req.json().catch(() => ({}))) as { url?: string };
  if (!url) return NextResponse.json({ error: "Paste a job link." }, { status: 400 });

  const parsed = parseJobUrl(url);
  if (!parsed) {
    return NextResponse.json(
      { error: "We can read Greenhouse, Lever and Ashby links for now. Paste one of those." },
      { status: 422 },
    );
  }

  // Add to the watched set (idempotent), then resolve the company id.
  await db
    .insert(companies)
    .values({ name: parsed.slug, ats: parsed.ats, atsSlug: parsed.slug })
    .onConflictDoNothing({ target: [companies.ats, companies.atsSlug] });
  const company = await db.query.companies.findFirst({
    where: and(eq(companies.ats, parsed.ats), eq(companies.atsSlug, parsed.slug)),
  });
  if (!company) return NextResponse.json({ error: "Could not add that company." }, { status: 500 });

  // Crawl now (so the role is in the DB), then score for this user.
  const count = await crawlCompany(company.id, parsed.slug, parsed.ats);
  if (count === 0) {
    return NextResponse.json(
      { error: "That board has no open postings we can read right now." },
      { status: 422 },
    );
  }
  await enqueueScoreUser({ userId: session.user.id }, 2);

  return NextResponse.json({ ok: true, company: company.name, postings: count });
}
