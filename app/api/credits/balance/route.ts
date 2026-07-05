import { NextResponse } from "next/server";
import { getSession } from "@/lib/get-session";
import { getBalance } from "@/lib/credits";

// Current spendable credit balance, for the reactive credits badge to poll.
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const balance = await getBalance(session.user.id);
  return NextResponse.json({ balance });
}
