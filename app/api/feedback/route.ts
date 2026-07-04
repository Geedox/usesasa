import { NextResponse } from "next/server";
import { getSession } from "@/lib/get-session";
import { db } from "@/lib/db";
import { feedback } from "@/lib/db/schema";

const CATEGORIES = new Set(["idea", "bug", "praise", "other"]);

// A signed-in user leaves feedback; it shows up in the admin.
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { message?: string; category?: string; page?: string };
  const message = (body.message ?? "").trim();
  if (message.length < 3) return NextResponse.json({ error: "Please write a little more." }, { status: 400 });
  if (message.length > 4000) return NextResponse.json({ error: "That is too long." }, { status: 400 });

  const category = body.category && CATEGORIES.has(body.category) ? body.category : null;
  const page = typeof body.page === "string" ? body.page.slice(0, 300) : null;

  await db.insert(feedback).values({ userId: session.user.id, message, category, page });
  return NextResponse.json({ ok: true });
}
