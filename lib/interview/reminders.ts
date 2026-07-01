import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { interviewBookings } from "@/lib/db/schema";
import { enqueueInterviewReminder, type InterviewReminderKind } from "@/lib/queue";
import { notifyInterviewReminder } from "@/lib/interview/notify";

// How far before the call each reminder fires.
const OFFSETS: { kind: InterviewReminderKind; ms: number }[] = [
  { kind: "24h", ms: 24 * 60 * 60 * 1000 },
  { kind: "1h", ms: 60 * 60 * 1000 },
  { kind: "10min", ms: 10 * 60 * 1000 },
];

// Queue the 24h / 1h / 10min reminders for a confirmed booking. Offsets already in
// the past (e.g. a call booked for 30 minutes from now) are simply skipped.
export async function scheduleReminders(bookingId: string, scheduledAt: Date): Promise<void> {
  const now = Date.now();
  for (const { kind, ms } of OFFSETS) {
    const fireAt = new Date(scheduledAt.getTime() - ms);
    if (fireAt.getTime() <= now) continue;
    await enqueueInterviewReminder({ bookingId, kind }, fireAt);
  }
}

// Worker handler: send one reminder, unless the booking is no longer confirmed or
// this reminder already went out (idempotent guard for pg-boss retries).
export async function processInterviewReminder(bookingId: string, kind: InterviewReminderKind): Promise<void> {
  const booking = await db.query.interviewBookings.findFirst({ where: eq(interviewBookings.id, bookingId) });
  if (!booking || booking.status !== "confirmed") return;

  const sent = (booking.remindersSent as string[] | null) ?? [];
  if (sent.includes(kind)) return;

  await notifyInterviewReminder(bookingId, kind);

  await db
    .update(interviewBookings)
    .set({ remindersSent: [...sent, kind], updatedAt: new Date() })
    .where(eq(interviewBookings.id, bookingId));
}
