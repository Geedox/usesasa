import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getAdminSession } from "@/lib/admin";
import { db } from "@/lib/db";
import { mentors, users } from "@/lib/db/schema";

// Admin manually adds a mentor to the roster (separate from approving an applicant).
// A mentor is a user: we link the mentor to that user's account by email so they get
// assignments and can open the mentor dashboard to join.
export async function POST(req: Request) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Not authorized." }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    userEmail?: string;
    title?: string;
    bio?: string;
    expertise?: string;
    calLink?: string;
    photoUrl?: string;
    sortOrder?: number;
  };

  const name = body.name?.trim();
  if (!name) return NextResponse.json({ error: "Name is required." }, { status: 400 });

  const userEmail = body.userEmail?.trim().toLowerCase();
  if (!userEmail) return NextResponse.json({ error: "Enter the mentor's account email." }, { status: 400 });
  const account = await db.query.users.findFirst({ where: eq(users.email, userEmail) });
  if (!account) return NextResponse.json({ error: "No Sasa account with that email. Ask them to sign up first." }, { status: 404 });

  const expertise = (body.expertise || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  await db.insert(mentors).values({
    userId: account.id,
    name,
    title: body.title?.trim() || null,
    bio: body.bio?.trim() || null,
    expertise: expertise.length ? expertise : null,
    calLink: body.calLink?.trim() || null,
    photoUrl: body.photoUrl?.trim() || account.image || null,
    sortOrder: body.sortOrder ?? 0,
    active: true,
  });

  return NextResponse.json({ ok: true });
}
