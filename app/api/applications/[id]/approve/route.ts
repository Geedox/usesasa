import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getSession } from "@/lib/get-session";
import { db } from "@/lib/db";
import { applications } from "@/lib/db/schema";
import { enqueueSubmitApplication } from "@/lib/queue";

// Approve a reviewed application -> queue a Steel cloud submission (a cloud browser
// we control fills + submits; the live-view is embedded in the dashboard so the
// user can watch and take over). The extension remains a fallback.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const { id } = await params;

  const updated = await db
    .update(applications)
    .set({ state: "queued" })
    .where(and(eq(applications.id, id), eq(applications.userId, session.user.id)))
    .returning({ id: applications.id });

  if (updated.length === 0) return NextResponse.json({ error: "Not found." }, { status: 404 });
  await enqueueSubmitApplication({ applicationId: id });
  return NextResponse.json({ ok: true });
}
