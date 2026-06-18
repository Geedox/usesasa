import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { applications } from "@/lib/db/schema";
import { userFromBearer } from "@/lib/extension-auth";
import { chargeForSubmission } from "@/lib/credits";
import { notifySubmissionBlocked } from "@/lib/telegram";

type Result = "submitted" | "needs_user" | "failed";

export async function POST(req: Request) {
  const user = await userFromBearer(req);
  if (!user) return NextResponse.json({ error: "Invalid token." }, { status: 401 });

  const { applicationId, result, reason } = (await req.json().catch(() => ({}))) as {
    applicationId?: string;
    result?: Result;
    reason?: string;
  };
  if (!applicationId || !["submitted", "needs_user", "failed"].includes(result ?? "")) {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  console.log(`[extension] report received app=${applicationId} result=${result} user=${user.id}`);

  const app = await db.query.applications.findFirst({
    where: and(eq(applications.id, applicationId), eq(applications.userId, user.id)),
  });
  if (!app) {
    console.warn(`[extension] report: app ${applicationId} not found for user ${user.id}`);
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  if (result === "submitted") {
    // Already submitted? don't double-charge.
    if (app.state === "submitted") {
      console.log(`[extension] app ${applicationId} already submitted, skipping charge`);
      return NextResponse.json({ ok: true, alreadyDone: true });
    }
    const balanceAfter = await chargeForSubmission(user.id, applicationId);
    if (balanceAfter === null) {
      console.warn(`[extension] no credits for user ${user.id}, holding app ${applicationId}`);
      await db.update(applications).set({ state: "needs_user" }).where(eq(applications.id, applicationId));
      return NextResponse.json({ error: "No credits." }, { status: 402 });
    }
    await db
      .update(applications)
      .set({ state: "submitted", submittedAt: new Date(), creditsCharged: 1, pipelineStatus: "applied", pipelineUpdatedAt: new Date(), submissionNote: null })
      .where(eq(applications.id, applicationId));
    console.log(`[extension] app ${applicationId} SUBMITTED, charged 1, balance now ${balanceAfter}`);
    return NextResponse.json({ ok: true, balance: balanceAfter });
  }

  // needs_user / failed — no charge. Store the reason and tell the user on Telegram.
  const note = reason?.slice(0, 300) ?? (result === "failed" ? "the submission failed" : "a field needs your input");
  console.log(`[extension] app ${applicationId} -> ${result}: ${note}`);
  await db.update(applications).set({ state: result as Result, submissionNote: note }).where(eq(applications.id, applicationId));
  await notifySubmissionBlocked(applicationId, result as "needs_user" | "failed", note);
  return NextResponse.json({ ok: true });
}
