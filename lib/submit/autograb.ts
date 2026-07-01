import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { applications } from "@/lib/db/schema";
import { isGmailActive, findVerification } from "@/lib/integrations/gmail";
import { enqueueAutoGrabCode } from "@/lib/queue";
import { resumeWithCode, pushStep } from "@/lib/submit/steel";

const MAX_ATTEMPTS = 10; // ~10 polls; with 15s spacing that covers ~2.5 minutes
const RETRY_DELAY_SECONDS = 15;

// Try to read the verification code a paused submission is waiting on from the
// user's Gmail and resume automatically. Re-enqueues itself until the code arrives
// or we give up (then the user enters it manually). No-op once the app has moved on.
export async function processAutoGrabCode(applicationId: string, attempt: number): Promise<void> {
  const app = await db.query.applications.findFirst({ where: eq(applications.id, applicationId) });
  // Stop if it is no longer waiting on a code (submitted, resumed, or skipped).
  if (!app || app.state === "submitted" || !app.awaitingCode || app.state !== "needs_user") return;

  // Only when the user has Gmail connected and not paused — otherwise leave it manual.
  if (!(await isGmailActive(app.userId))) return;

  const v = await findVerification(app.userId, "newer_than:1h (code OR verification OR verify OR confirm OR otp OR sign in)");

  if (v.code) {
    await pushStep(applicationId, "Found your verification code in Gmail");
    const r = await resumeWithCode(applicationId, v.code);
    if (r.result !== "submitted") {
      // Wrong/expired code or a deeper block — hand back to the user rather than loop.
      await pushStep(applicationId, "Could not complete with the emailed code — needs you", "error");
    }
    return;
  }

  // Code not in the inbox yet — poll again shortly, up to the cap.
  if (attempt + 1 < MAX_ATTEMPTS) {
    await enqueueAutoGrabCode({ applicationId, attempt: attempt + 1 }, RETRY_DELAY_SECONDS).catch(() => null);
  }
}
