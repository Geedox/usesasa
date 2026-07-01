import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getSession } from "@/lib/get-session";
import { db } from "@/lib/db";
import { profiles } from "@/lib/db/schema";
import { normalizeProfile, profileSchema } from "@/lib/profile";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const profile = await db.query.profiles.findFirst({
    where: and(eq(profiles.userId, session.user.id), eq(profiles.isCurrent, true)),
  });

  return NextResponse.json({
    hasCv: !!profile,
    parsed: !!profile?.parsedData,
    profile: profile?.parsedData ? normalizeProfile(profile.parsedData) : null,
  });
}

export async function PUT(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const result = profileSchema.safeParse(body);
  if (!result.success) {
    const msg = result.error.issues[0]?.message ?? "Invalid profile.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const updated = await db
    .update(profiles)
    .set({ parsedData: result.data })
    .where(and(eq(profiles.userId, session.user.id), eq(profiles.isCurrent, true)))
    .returning({ id: profiles.id });

  if (updated.length === 0) {
    return NextResponse.json({ error: "No profile to update. Upload a CV first." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
