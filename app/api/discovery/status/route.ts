import { NextResponse } from "next/server";
import { and, eq, gte, sql } from "drizzle-orm";
import { getSession } from "@/lib/get-session";
import { db } from "@/lib/db";
import { matches } from "@/lib/db/schema";
import { MATCH_THRESHOLD } from "@/lib/matching/score";

// Lets the dashboard show a live "finding jobs" state: how many surfaced matches
// the user has, and whether a scan (crawl or score) is still in flight.
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const userId = session.user.id;

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(matches)
    .where(and(eq(matches.userId, userId), gte(matches.score, MATCH_THRESHOLD)));

  // Is a relevant job still queued/running in pg-boss?
  let pending = false;
  try {
    const res = await db.execute(sql`
      SELECT count(*)::int AS n FROM pgboss.job
      WHERE state IN ('created','active','retry')
      AND (
        (name = 'score_user' AND data->>'userId' = ${userId})
        OR name IN ('discover_company','discover_aggregator')
      )
    `);
    const rows = (res as unknown as { rows?: { n: number }[] }).rows ?? (res as unknown as { n: number }[]);
    pending = Number(rows?.[0]?.n ?? 0) > 0;
  } catch {
    pending = false;
  }

  return NextResponse.json({ matchCount: Number(count), pending });
}
