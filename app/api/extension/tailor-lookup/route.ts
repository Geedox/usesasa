import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { applications, jobs } from "@/lib/db/schema";
import { userFromBearer } from "@/lib/extension-auth";

// On (re)visiting a job page the widget asks: have I already tailored this one?
// If so it shows the download/fill actions instead of offering to tailor again
// (which would re-charge a credit). Matches the job by its page URL. The widget
// then fetches the full result via /api/extension/tailor-result?id=<applicationId>.
export async function GET(req: Request) {
  const user = await userFromBearer(req);
  if (!user) return NextResponse.json({ error: "Invalid token." }, { status: 401 });

  const url = new URL(req.url).searchParams.get("url");
  if (!url) return NextResponse.json({ found: false });

  const job = await db.query.jobs.findFirst({ where: eq(jobs.url, url) });
  if (!job) return NextResponse.json({ found: false });

  const app = await db.query.applications.findFirst({
    where: and(eq(applications.userId, user.id), eq(applications.jobId, job.id)),
  });
  if (!app) return NextResponse.json({ found: false });

  // ready = tailoring done; otherwise it's still queued / in progress.
  return NextResponse.json({ found: true, applicationId: app.id, ready: !!app.tailoredCv, state: app.state });
}
