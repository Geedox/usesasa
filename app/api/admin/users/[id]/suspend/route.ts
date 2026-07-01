import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getAdminSession } from "@/lib/admin";
import { db } from "@/lib/db";
import { users, sessions } from "@/lib/db/schema";

// Admin suspends or reinstates a user. Suspending also clears their active sessions
// so the block takes effect immediately.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  const { id } = await params;

  const body = (await req.json().catch(() => ({}))) as { suspend?: boolean; reason?: string };
  const suspend = !!body.suspend;

  const target = await db.query.users.findFirst({ where: eq(users.id, id), columns: { id: true, email: true } });
  if (!target) return NextResponse.json({ error: "User not found." }, { status: 404 });
  // Don't let an admin lock themselves out.
  if (suspend && target.email.toLowerCase() === admin.user.email.toLowerCase()) {
    return NextResponse.json({ error: "You cannot suspend your own admin account." }, { status: 400 });
  }

  await db
    .update(users)
    .set({
      suspendedAt: suspend ? new Date() : null,
      suspendedReason: suspend ? (body.reason?.trim() || null) : null,
      updatedAt: new Date(),
    })
    .where(eq(users.id, id));

  // Revoke sessions on suspend so the user is signed out right away.
  if (suspend) await db.delete(sessions).where(eq(sessions.userId, id));

  return NextResponse.json({ ok: true, suspended: suspend });
}
