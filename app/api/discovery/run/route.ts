import { NextResponse } from "next/server";
import { getSession } from "@/lib/get-session";
import { enqueueCrawlAll } from "@/lib/discovery/cycle";
import { enqueueScoreUser } from "@/lib/queue";
import { canUseSasa } from "@/lib/can-use";
import { isSubscriber } from "@/lib/subscription";
import { chargeForDiscovery } from "@/lib/credits";

// Manual trigger ("Find more"): crawl every board, then score the current user for
// an instant refresh. Costs 1 credit (credits users) since it runs the expensive
// LLM scoring; subscribers are covered by their plan. The scheduled tick does the
// same for all users on a cron (free).
export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  // No credits/allowance, no scan: matching is the costly part.
  const can = await canUseSasa(session.user.id);
  if (!can.ok) return NextResponse.json({ error: can.error }, { status: 402 });

  // Charge 1 credit for the scan (credits users only; subscribers are metered by
  // applications, not scans).
  if (!(await isSubscriber(session.user.id))) {
    const balance = await chargeForDiscovery(session.user.id);
    if (balance === null) {
      return NextResponse.json({ error: "Please add credits to find more jobs." }, { status: 402 });
    }
  }

  const companies = await enqueueCrawlAll();

  // Give discovery a head start, then score this user (auto-tailors top matches).
  await enqueueScoreUser({ userId: session.user.id }, 30);

  return NextResponse.json({ ok: true, companies });
}
