import { NextResponse } from "next/server";
import { getSession } from "@/lib/get-session";
import { enqueueCrawlAll } from "@/lib/discovery/cycle";
import { enqueueScoreUser } from "@/lib/queue";

// Manual trigger ("Find jobs"): crawl every board, then score the current user
// for an instant refresh. The scheduled tick does the same for all users on a cron.
export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const companies = await enqueueCrawlAll();

  // Give discovery a head start, then score this user (auto-tailors top matches).
  await enqueueScoreUser({ userId: session.user.id }, 30);

  return NextResponse.json({ ok: true, companies });
}
