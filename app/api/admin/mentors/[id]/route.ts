import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getAdminSession } from "@/lib/admin";
import { db } from "@/lib/db";
import { mentors, users } from "@/lib/db/schema";

// Admin updates a mentor: toggle active, edit fields, or link to a user account by email.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  const { id } = await params;

  const body = (await req.json().catch(() => ({}))) as {
    active?: boolean;
    name?: string;
    title?: string;
    calLink?: string;
    expertise?: string;
    sortOrder?: number;
    userEmail?: string;
  };

  const set: Record<string, unknown> = {};
  if (typeof body.active === "boolean") set.active = body.active;
  if (typeof body.name === "string") set.name = body.name.trim();
  if (typeof body.title === "string") set.title = body.title.trim() || null;
  if (typeof body.calLink === "string") set.calLink = body.calLink.trim() || null;
  if (typeof body.sortOrder === "number") set.sortOrder = body.sortOrder;
  if (typeof body.expertise === "string") {
    const e = body.expertise.split(",").map((s) => s.trim()).filter(Boolean);
    set.expertise = e.length ? e : null;
  }
  if (typeof body.userEmail === "string" && body.userEmail.trim()) {
    const account = await db.query.users.findFirst({ where: eq(users.email, body.userEmail.trim().toLowerCase()) });
    if (!account) return NextResponse.json({ error: "No Sasa account with that email." }, { status: 404 });
    set.userId = account.id;
  }
  if (Object.keys(set).length === 0) return NextResponse.json({ error: "Nothing to update." }, { status: 400 });

  const updated = await db.update(mentors).set(set).where(eq(mentors.id, id)).returning({ id: mentors.id });
  if (!updated.length) return NextResponse.json({ error: "Mentor not found." }, { status: 404 });

  return NextResponse.json({ ok: true });
}
