import { desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { Video, CalendarClock } from "lucide-react";
import { getSession } from "@/lib/get-session";
import { db } from "@/lib/db";
import { interviewBookings, mentors } from "@/lib/db/schema";
import { calManageUrl, CAL_ORIGIN } from "@/lib/interview/cal";
import { MentorFeedback } from "@/components/dashboard/mentor-feedback";

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

export default async function MentorDashboardPage() {
  const session = await getSession();
  if (!session) return null;

  const mentor = await db.query.mentors.findFirst({ where: eq(mentors.userId, session.user.id) });
  if (!mentor) redirect("/dashboard/become-a-mentor");

  const rows = await db
    .select()
    .from(interviewBookings)
    .where(eq(interviewBookings.mentorId, mentor.id))
    .orderBy(desc(interviewBookings.scheduledAt));

  const now = Date.now();
  const upcoming = rows.filter((b) => b.status === "confirmed" && (!b.scheduledAt || b.scheduledAt.getTime() >= now));
  const toReview = rows.filter(
    (b) => (b.status === "completed" || (b.status === "confirmed" && b.scheduledAt && b.scheduledAt.getTime() < now)),
  );

  return (
    <main className="max-w-[1400px] mx-auto px-6 lg:px-10 py-8 pb-16">
      <div className="mb-6">
        <h1 className="font-display text-2xl mb-1">Mentor dashboard</h1>
        <p className="text-sm text-muted-foreground">Your assigned interview prep calls. Run the session, then score and give honest feedback.</p>
      </div>

      <section className="mb-8">
        <h2 className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase mb-3">Upcoming</h2>
        {upcoming.length === 0 ? (
          <p className="text-sm text-muted-foreground">No upcoming calls assigned yet.</p>
        ) : (
          <div className="grid gap-3">
            {upcoming.map((b) => (
              <div key={b.id} className="rounded-xl border border-foreground/10 bg-background p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{[b.jobTitle, b.companyName].filter(Boolean).join(" at ") || "Interview prep"}</div>
                    <div className="mt-1 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                      <CalendarClock className="h-3.5 w-3.5" /> {formatWhen(b.scheduledAt)}
                    </div>
                  </div>
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
                    <a href={calManageUrl(b.calBookingUid)} target="_blank" rel="noreferrer" className="text-sm text-muted-foreground hover:text-foreground">
                      View on Cal
                    </a>
                  )}
                </div>
                {(b.skills || b.jobDescription || b.externalJobUrl) && (
                  <div className="mt-3 rounded-lg bg-foreground/[0.03] p-3 text-sm text-foreground/90">
                    {b.skills && <p><span className="text-muted-foreground">Focus:</span> {b.skills}</p>}
                    {b.externalJobUrl && (
                      <p className="truncate"><span className="text-muted-foreground">Job:</span> <a className="underline" href={b.externalJobUrl} target="_blank" rel="noreferrer">{b.externalJobUrl}</a></p>
                    )}
                    {b.jobDescription && <p className="mt-1 line-clamp-4 text-muted-foreground">{b.jobDescription}</p>}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase mb-3">Feedback</h2>
        {toReview.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing to review yet.</p>
        ) : (
          <div className="grid gap-3">
            {toReview.map((b) => (
              <div key={b.id} className="rounded-xl border border-foreground/10 bg-background p-4">
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-sm">{[b.jobTitle, b.companyName].filter(Boolean).join(" at ") || "Interview prep"}</div>
                    <div className="text-xs text-muted-foreground">{formatWhen(b.scheduledAt)}</div>
                  </div>
                  {typeof b.feedbackScore === "number" && (
                    <span className="rounded-full bg-foreground/[0.06] px-2.5 py-1 text-sm font-medium">{b.feedbackScore}/100</span>
                  )}
                </div>
                <MentorFeedback bookingId={b.id} initialScore={b.feedbackScore} initialFeedback={b.feedbackText} />
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
