import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { interviewBookings, mentors, mentorApplications, users, preferences } from "@/lib/db/schema";
import { sendMessage, telegramEnabled } from "@/lib/telegram";
import { sendEmail } from "@/lib/email";
import { SITE_URL } from "@/lib/site";
import { INTERVIEW_COST } from "@/lib/credits";
import type { InterviewReminderKind } from "@/lib/queue";

const PREP_URL = `${SITE_URL}/dashboard/interview-prep`;
const MENTOR_URL = `${SITE_URL}/dashboard/become-a-mentor`;

type Loaded = {
  booking: typeof interviewBookings.$inferSelect;
  user: typeof users.$inferSelect;
  mentor: typeof mentors.$inferSelect | null;
  timezone: string;
};

async function load(bookingId: string): Promise<Loaded | null> {
  const booking = await db.query.interviewBookings.findFirst({ where: eq(interviewBookings.id, bookingId) });
  if (!booking) return null;
  const user = await db.query.users.findFirst({ where: eq(users.id, booking.userId) });
  if (!user) return null;
  const mentor = booking.mentorId
    ? (await db.query.mentors.findFirst({ where: eq(mentors.id, booking.mentorId) })) ?? null
    : null;
  const prefs = await db.query.preferences.findFirst({ where: eq(preferences.userId, booking.userId) });
  return { booking, user, mentor, timezone: prefs?.digestTimezone || "Africa/Lagos" };
}

function formatWhen(at: Date | null, timezone: string): string {
  if (!at) return "soon";
  try {
    return new Intl.DateTimeFormat("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: timezone,
      timeZoneName: "short",
    }).format(at);
  } catch {
    return at.toUTCString();
  }
}

function roleLine(b: typeof interviewBookings.$inferSelect): string {
  const parts = [b.jobTitle, b.companyName].filter(Boolean);
  return parts.length ? parts.join(" at ") : "your interview";
}

async function dispatch(user: typeof users.$inferSelect, subject: string, body: string, telegramHtml: string): Promise<void> {
  if (telegramEnabled() && user.telegramChatId) {
    await sendMessage(user.telegramChatId, telegramHtml);
  }
  if (user.email) {
    await sendEmail({ to: user.email, subject, text: body });
  }
}

// Sent once a Cal booking is confirmed and the credits are charged.
export async function notifyInterviewBooked(bookingId: string): Promise<void> {
  const data = await load(bookingId);
  if (!data) return;
  const { booking, user, mentor, timezone } = data;
  const when = formatWhen(booking.scheduledAt, timezone);
  const who = mentor?.name ? `with ${mentor.name}` : "with one of our senior professionals";
  const role = roleLine(booking);

  const subject = "Your interview prep call is booked";
  const text = `Your interview prep call ${who} is confirmed for ${when}.

Prepping for: ${role}
${booking.meetingUrl ? `Join link: ${booking.meetingUrl}` : "We will send your join link shortly."}

We charged ${INTERVIEW_COST} credits for this session. See it anytime: ${PREP_URL}

Good luck. You have got this.`;

  const html = `<b>Interview prep booked</b>\nYour call ${who} is confirmed for <b>${when}</b>.\n\nPrepping for: ${role}${booking.meetingUrl ? `\nJoin: ${booking.meetingUrl}` : ""}\n\n${INTERVIEW_COST} credits charged. ${PREP_URL}`;

  await dispatch(user, subject, text, html);
}

const KIND_LABEL: Record<InterviewReminderKind, string> = {
  "24h": "in 24 hours",
  "1h": "in 1 hour",
  "10min": "in 10 minutes",
};

// Sent at each reminder offset before the call.
export async function notifyInterviewReminder(bookingId: string, kind: InterviewReminderKind): Promise<void> {
  const data = await load(bookingId);
  if (!data) return;
  const { booking, user, mentor, timezone } = data;
  const when = formatWhen(booking.scheduledAt, timezone);
  const who = mentor?.name ? `with ${mentor.name}` : "with our senior professional";
  const role = roleLine(booking);
  const label = KIND_LABEL[kind];

  const subject = `Interview prep reminder: your call is ${label}`;
  const text = `Reminder: your interview prep call ${who} is ${label} (${when}).

Prepping for: ${role}
${booking.meetingUrl ? `Join link: ${booking.meetingUrl}` : `Open your dashboard for the join link: ${PREP_URL}`}

Take a breath. You are ready.`;

  const html = `<b>Interview prep ${label}</b>\nYour call ${who} is at <b>${when}</b>.\n\nPrepping for: ${role}${booking.meetingUrl ? `\nJoin: ${booking.meetingUrl}` : `\n${PREP_URL}`}`;

  await dispatch(user, subject, text, html);
}

// Sent when a booking is cancelled and the credits are refunded.
export async function notifyInterviewCancelled(bookingId: string): Promise<void> {
  const data = await load(bookingId);
  if (!data) return;
  const { booking, user } = data;
  const role = roleLine(booking);

  const subject = "Your interview prep call was cancelled";
  const text = `Your interview prep call for ${role} has been cancelled and your ${INTERVIEW_COST} credits were refunded.

Book another slot whenever you are ready: ${PREP_URL}`;

  const html = `<b>Interview prep cancelled</b>\nYour call for ${role} was cancelled and ${INTERVIEW_COST} credits refunded.\n\nBook again: ${PREP_URL}`;

  await dispatch(user, subject, text, html);
}

// Sent to the interviewee once an admin assigns a mentor to their call.
export async function notifyMentorAssigned(bookingId: string): Promise<void> {
  const data = await load(bookingId);
  if (!data || !data.mentor) return;
  const { booking, user, mentor, timezone } = data;
  const when = formatWhen(booking.scheduledAt, timezone);
  const role = roleLine(booking);

  const subject = `Your mentor is ${mentor.name}`;
  const text = `Good news. ${mentor.name}${mentor.title ? `, ${mentor.title}` : ""} will take your interview prep call for ${role} on ${when}.

See the details: ${PREP_URL}`;

  const html = `<b>Mentor assigned</b>\n${mentor.name}${mentor.title ? `, ${mentor.title}` : ""} will take your call for ${role} on <b>${when}</b>.\n\n${PREP_URL}`;

  await dispatch(user, subject, text, html);
}

// Sent to the interviewee once their mentor submits feedback and a score.
export async function notifyFeedbackReady(bookingId: string): Promise<void> {
  const data = await load(bookingId);
  if (!data) return;
  const { booking, user } = data;
  const role = roleLine(booking);
  const score = typeof booking.feedbackScore === "number" ? `${booking.feedbackScore}/100` : "";

  const subject = "Your interview feedback is ready";
  const text = `Your mentor has shared feedback on your prep call for ${role}${score ? ` and scored it ${score}` : ""}.

Read it here: ${PREP_URL}`;

  const html = `<b>Interview feedback ready</b>\nYour mentor reviewed your call for ${role}${score ? ` and scored it <b>${score}</b>` : ""}.\n\n${PREP_URL}`;

  await dispatch(user, subject, text, html);
}

// Sent to a mentor applicant when an admin approves or rejects their application.
export async function notifyMentorApplicationDecision(applicationId: string): Promise<void> {
  const appRow = await db.query.mentorApplications.findFirst({ where: eq(mentorApplications.id, applicationId) });
  if (!appRow) return;
  const user = await db.query.users.findFirst({ where: eq(users.id, appRow.userId) });
  if (!user) return;

  if (appRow.status === "approved") {
    const subject = "You are now a Sasa mentor";
    const text = `Congratulations. Your application to become a mentor has been approved. We will start assigning you to candidates that fit your expertise.

Open your mentor dashboard: ${SITE_URL}/dashboard/mentor`;
    const html = `<b>Welcome aboard</b>\nYour mentor application was approved. We will start assigning you candidates.\n\n${SITE_URL}/dashboard/mentor`;
    await dispatch(user, subject, text, html);
    return;
  }

  if (appRow.status === "rejected") {
    const subject = "Update on your mentor application";
    const text = `Thank you for applying to be a mentor. We are not able to approve your application this time.

${appRow.rejectionReason ? `Reason: ${appRow.rejectionReason}\n\n` : ""}You are welcome to address this and apply again: ${MENTOR_URL}`;
    const html = `<b>Mentor application update</b>\nWe could not approve your application this time.${appRow.rejectionReason ? `\n\nReason: ${appRow.rejectionReason}` : ""}\n\nApply again: ${MENTOR_URL}`;
    await dispatch(user, subject, text, html);
  }
}
