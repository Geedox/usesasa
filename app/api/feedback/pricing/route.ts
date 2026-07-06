import { NextResponse } from "next/server";
import { getSession } from "@/lib/get-session";
import { db } from "@/lib/db";
import { feedback } from "@/lib/db/schema";

// The "okay with monthly billing?" poll in Settings > Plans & Billing. Records a Yes
// as feedback (with the signed-in user) so the founders can gauge appetite. Logged-in
// only; the admin sees the user + email via the feedback panel.
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const { note } = (await req.json().catch(() => ({}))) as { note?: string };
  const extra = typeof note === "string" && note.trim() ? ` Note: ${note.trim().slice(0, 500)}` : "";

  await db.insert(feedback).values({
    userId: session.user.id,
    category: "pricing",
    message: `Okay with month to month billing (Plans & Billing poll).${extra}`,
    page: "/dashboard/settings?tab=billing",
  });

  return NextResponse.json({ ok: true });
}
