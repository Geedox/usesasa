import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { interviewBookings, users } from "@/lib/db/schema";
import { chargeForInterview, refundInterview, INTERVIEW_COST } from "@/lib/credits";
import { verifyCalSignature, extractMeetingUrl, extractSasaBookingId, extractAttendeeEmail, jitsiRoomUrl } from "@/lib/interview/cal";
import { scheduleReminders } from "@/lib/interview/reminders";
import { notifyInterviewBooked, notifyInterviewCancelled } from "@/lib/interview/notify";

// Inbound Cal.com webhook. The authoritative path for confirming a booking (and
// charging the 3 credits), plus cancellations (refund) and reschedules. We verify
// the HMAC signature, then match the Cal booking to our pending row via metadata.
export async function POST(req: Request) {
  const raw = await req.text();
  const signature = req.headers.get("x-cal-signature-256");
  if (!verifyCalSignature(raw, signature)) {
    return NextResponse.json({ error: "Bad signature." }, { status: 401 });
  }

  let event: { triggerEvent?: string; payload?: Record<string, unknown> };
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const trigger = event.triggerEvent;
  const payload = event.payload ?? {};
  const uid = typeof payload.uid === "string" ? payload.uid : null;
  const startTime = typeof payload.startTime === "string" ? new Date(payload.startTime) : null;

  if (trigger === "BOOKING_CREATED") {
    const bookingId = extractSasaBookingId(payload);

    let booking = bookingId
      ? await db.query.interviewBookings.findFirst({ where: eq(interviewBookings.id, bookingId) })
      : undefined;

    // Fallback: no marker found — match the booker's most recent pending booking.
    if (!booking) {
      const email = extractAttendeeEmail(payload);
      if (email) {
        const u = await db.query.users.findFirst({ where: eq(users.email, email) });
        if (u) {
          booking = await db.query.interviewBookings.findFirst({
            where: and(eq(interviewBookings.userId, u.id), eq(interviewBookings.status, "pending")),
            orderBy: desc(interviewBookings.createdAt),
          });
        }
      }
    }

    if (!booking) return NextResponse.json({ ok: true, skipped: "no matching booking" });
    if (booking.status === "confirmed") return NextResponse.json({ ok: true, skipped: "already confirmed" });

    const charged = await chargeForInterview(booking.userId, booking.id);
    // Even if the charge fails (somehow out of credits), still record the booking so
    // it is visible; mark it confirmed with 0 credits and let support reconcile.
    await db
      .update(interviewBookings)
      .set({
        status: "confirmed",
        calBookingUid: uid,
        meetingUrl: extractMeetingUrl(payload) ?? jitsiRoomUrl(booking.id),
        scheduledAt: startTime,
        creditsCharged: charged === null ? 0 : INTERVIEW_COST,
        updatedAt: new Date(),
      })
      .where(eq(interviewBookings.id, booking.id));

    if (startTime) await scheduleReminders(booking.id, startTime);
    await notifyInterviewBooked(booking.id);
    return NextResponse.json({ ok: true });
  }

  if (trigger === "BOOKING_CANCELLED") {
    const booking = uid
      ? await db.query.interviewBookings.findFirst({ where: eq(interviewBookings.calBookingUid, uid) })
      : null;
    if (!booking) return NextResponse.json({ ok: true, skipped: "unknown booking" });
    if (booking.status === "cancelled") return NextResponse.json({ ok: true, skipped: "already cancelled" });

    if (booking.creditsCharged > 0) await refundInterview(booking.userId, booking.id);
    await db
      .update(interviewBookings)
      .set({ status: "cancelled", creditsCharged: 0, updatedAt: new Date() })
      .where(eq(interviewBookings.id, booking.id));

    await notifyInterviewCancelled(booking.id);
    return NextResponse.json({ ok: true });
  }

  if (trigger === "MEETING_ENDED") {
    const booking = uid
      ? await db.query.interviewBookings.findFirst({ where: eq(interviewBookings.calBookingUid, uid) })
      : null;
    if (booking && booking.status === "confirmed") {
      await db
        .update(interviewBookings)
        .set({ status: "completed", updatedAt: new Date() })
        .where(eq(interviewBookings.id, booking.id));
    }
    return NextResponse.json({ ok: true });
  }

  if (trigger === "BOOKING_RESCHEDULED") {
    // Cal may key the reschedule by the original metadata or the old uid.
    const bookingId = extractSasaBookingId(payload);
    const booking = bookingId
      ? await db.query.interviewBookings.findFirst({ where: eq(interviewBookings.id, bookingId) })
      : uid
        ? await db.query.interviewBookings.findFirst({ where: eq(interviewBookings.calBookingUid, uid) })
        : null;
    if (!booking) return NextResponse.json({ ok: true, skipped: "unknown booking" });

    await db
      .update(interviewBookings)
      .set({
        calBookingUid: uid ?? booking.calBookingUid,
        meetingUrl: extractMeetingUrl(payload) ?? booking.meetingUrl ?? jitsiRoomUrl(booking.id),
        scheduledAt: startTime ?? booking.scheduledAt,
        remindersSent: [], // reset so the new time gets fresh reminders
        updatedAt: new Date(),
      })
      .where(eq(interviewBookings.id, booking.id));

    if (startTime) await scheduleReminders(booking.id, startTime);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: true, ignored: trigger });
}
