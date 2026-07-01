import { and, desc, eq } from "drizzle-orm";
import Link from "next/link";
import { Video, CalendarClock, Star } from "lucide-react";
import { getSession } from "@/lib/get-session";
import { db } from "@/lib/db";
import { mentors, interviewBookings, applications, jobs, companies } from "@/lib/db/schema";
import { getBalance, INTERVIEW_COST } from "@/lib/credits";
import { CAL_ORIGIN, CAL_SHARED_LINK, calManageUrl } from "@/lib/interview/cal";
import { CompanyAvatar } from "@/components/dashboard/company-avatar";
import { AvatarStack } from "@/components/dashboard/avatar-stack";
import { InterviewPrepBooking, type ApplicationOption } from "@/components/dashboard/interview-prep";

function formatWhen(at: Date | null): string {
  if (!at) return "Time to be confirmed";
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(at);
}

export default async function InterviewPrepPage() {
  const session = await getSession();
  if (!session) return null;
  const userId = session.user.id;

  const [appRows, bookingRows, balance, mentorRows] = await Promise.all([
    db
      .select({ id: applications.id, title: jobs.title, company: companies.name })
      .from(applications)
      .innerJoin(jobs, eq(applications.jobId, jobs.id))
      .innerJoin(companies, eq(jobs.companyId, companies.id))
      .where(and(eq(applications.userId, userId), eq(applications.state, "submitted")))
      .orderBy(desc(applications.submittedAt)),
    db
      .select({
        id: interviewBookings.id,
        status: interviewBookings.status,
        jobTitle: interviewBookings.jobTitle,
        companyName: interviewBookings.companyName,
        scheduledAt: interviewBookings.scheduledAt,
        meetingUrl: interviewBookings.meetingUrl,
        calBookingUid: interviewBookings.calBookingUid,
        feedbackScore: interviewBookings.feedbackScore,
        feedbackText: interviewBookings.feedbackText,
        mentorName: mentors.name,
        mentorTitle: mentors.title,
        mentorPhoto: mentors.photoUrl,
      })
      .from(interviewBookings)
      .leftJoin(mentors, eq(interviewBookings.mentorId, mentors.id))
      .where(eq(interviewBookings.userId, userId))
      .orderBy(desc(interviewBookings.scheduledAt)),
    getBalance(userId),
    db
      .select({ name: mentors.name, photoUrl: mentors.photoUrl })
      .from(mentors)
      .where(eq(mentors.active, true))
      .orderBy(mentors.sortOrder),
  ]);

  const appOptions: ApplicationOption[] = appRows.map((a) => ({
    id: a.id,
    label: `${a.title} at ${a.company}`,
  }));

  const mentorCount = mentorRows.length;

  const now = Date.now();
  const upcoming = bookingRows.filter(
    (b) => b.status === "confirmed" && (!b.scheduledAt || b.scheduledAt.getTime() >= now),
  );
  const past = bookingRows.filter(
    (b) => b.status === "completed" || (b.status === "confirmed" && b.scheduledAt && b.scheduledAt.getTime() < now),
  );

  return (
    <main className="max-w-[1400px] mx-auto px-6 lg:px-10 py-8 pb-16">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl mb-1">Interview prep</h1>
          <p className="text-sm text-muted-foreground max-w-2xl">
            The interview is where most people freeze. Book a one on one with a senior professional to practice, settle the nerves, and walk in ready.
          </p>
        </div>
        <Link
          href="/dashboard/become-a-mentor"
          className="shrink-0 rounded-lg border border-foreground/15 px-4 h-9 inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          Become a mentor
        </Link>
      </div>

      {mentorCount > 0 && (
        <div className="mb-8 flex items-center gap-4 rounded-xl border border-foreground/10 bg-background p-5">
          <AvatarStack people={mentorRows} total={mentorCount} size={44} />
          <div>
            <div className="font-medium">Access our {mentorCount} mentor{mentorCount === 1 ? "" : "s"}</div>
            <p className="text-sm text-muted-foreground">Senior professionals ready to run a mock interview with you.</p>
          </div>
        </div>
      )}

      {upcoming.length > 0 && (
        <section className="mb-8">
          <h2 className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase mb-3">Upcoming</h2>
          <div className="grid gap-3">
            {upcoming.map((b) => (
              <div key={b.id} className="flex flex-wrap items-center gap-4 rounded-xl border border-foreground/10 bg-background p-4">
                <CompanyAvatar name={b.mentorName || "Mentor"} logoUrl={b.mentorPhoto} size={44} />
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{b.mentorName || "Mentor to be assigned"}</div>
                  <div className="text-sm text-muted-foreground">
                    {[b.jobTitle, b.companyName].filter(Boolean).join(" at ") || "Interview prep"}
                  </div>
                  <div className="mt-1 inline-flex items-center gap-1.5 text-sm text-foreground">
                    <CalendarClock className="h-3.5 w-3.5" /> {formatWhen(b.scheduledAt)}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {b.meetingUrl && (
                    <a
                      href={b.meetingUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg bg-foreground text-background px-4 h-9 text-sm hover:bg-foreground/90"
                    >
                      <Video className="h-4 w-4" /> Join
                    </a>
                  )}
                  {b.calBookingUid && CAL_ORIGIN && (
                    <a
                      href={calManageUrl(b.calBookingUid)}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg border border-foreground/15 px-4 h-9 inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
                    >
                      Reschedule or cancel
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <InterviewPrepBooking
        applications={appOptions}
        calOrigin={CAL_ORIGIN}
        calLink={CAL_SHARED_LINK}
        credits={balance}
        cost={INTERVIEW_COST}
        name={session.user.name ?? ""}
        email={session.user.email}
      />

      {past.length > 0 && (
        <section className="mt-8">
          <h2 className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase mb-3">Past sessions</h2>
          <div className="grid gap-3">
            {past.map((b) => (
              <div key={b.id} className="rounded-xl border border-foreground/10 bg-background p-4">
                <div className="flex items-center gap-3">
                  <CompanyAvatar name={b.mentorName || "Mentor"} logoUrl={b.mentorPhoto} size={36} />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-sm">{b.mentorName || "Mentor"}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {[b.jobTitle, b.companyName].filter(Boolean).join(" at ")}
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">{formatWhen(b.scheduledAt)}</span>
                  {typeof b.feedbackScore === "number" && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-foreground/[0.06] px-2.5 py-1 text-sm font-medium">
                      <Star className="h-3.5 w-3.5 text-amber-500" /> {b.feedbackScore}/100
                    </span>
                  )}
                </div>
                {b.feedbackText && (
                  <div className="mt-3 rounded-lg bg-foreground/[0.03] p-3 text-sm text-foreground/90 whitespace-pre-wrap">
                    <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase mb-1">Mentor feedback</p>
                    {b.feedbackText}
                  </div>
                )}
                {typeof b.feedbackScore !== "number" && !b.feedbackText && (
                  <p className="mt-2 text-xs text-muted-foreground">Feedback will appear here once your mentor submits it.</p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
