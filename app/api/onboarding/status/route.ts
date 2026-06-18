import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getSession } from "@/lib/get-session";
import { db } from "@/lib/db";
import { profiles } from "@/lib/db/schema";

// Reports whether the current CV has finished parsing (drives the sidebar status).
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const profile = await db.query.profiles.findFirst({
    where: and(eq(profiles.userId, session.user.id), eq(profiles.isCurrent, true)),
  });

  return NextResponse.json({ parsed: !!profile?.parsedData });
}
