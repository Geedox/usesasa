import { desc, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/lib/db";
import { interviewBookings, mentors, users } from "@/lib/db/schema";
import { AssignMentor } from "@/components/admin/assign-mentor";

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

export default async function AdminBookingsPage() {
  const assignedMentor = alias(mentors, "assigned_mentor");

  const [rows, mentorRows] = await Promise.all([
    db
      .select({
        id: interviewBookings.id,
        status: interviewBookings.status,
        jobTitle: interviewBookings.jobTitle,
        companyName: interviewBookings.companyName,
        scheduledAt: interviewBookings.scheduledAt,
        skills: interviewBookings.skills,
        mentorId: interviewBookings.mentorId,
        mentorName: assignedMentor.name,
        userName: users.name,
        userEmail: users.email,
      })
      .from(interviewBookings)
      .innerJoin(users, eq(interviewBookings.userId, users.id))
      .leftJoin(assignedMentor, eq(interviewBookings.mentorId, assignedMentor.id))
      .orderBy(desc(interviewBookings.scheduledAt)),
    db.select({ id: mentors.id, name: mentors.name }).from(mentors).where(eq(mentors.active, true)).orderBy(mentors.sortOrder),
  ]);

  // Confirmed-but-unassigned first.
  const sorted = [...rows].sort((a, b) => {
    const aw = a.status === "confirmed" && !a.mentorId ? 0 : 1;
    const bw = b.status === "confirmed" && !b.mentorId ? 0 : 1;
    return aw - bw;
  });

  return (
    <main className="max-w-[1100px] mx-auto px-6 lg:px-10 py-8">
      <h1 className="font-display text-2xl mb-6">Bookings</h1>
      {sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground">No bookings yet.</p>
      ) : (
        <div className="grid gap-3">
          {sorted.map((b) => (
            <div key={b.id} className="rounded-2xl border border-foreground/10 bg-background p-5">
              <div className="flex flex-wrap items-start gap-4">
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{[b.jobTitle, b.companyName].filter(Boolean).join(" at ") || "Interview prep"}</div>
                  <div className="text-sm text-muted-foreground">{b.userName || b.userEmail} · {formatWhen(b.scheduledAt)}</div>
                  {b.skills && <div className="text-sm text-muted-foreground mt-1">Focus: {b.skills}</div>}
                  <div className="text-xs text-muted-foreground mt-1">
                    Status: {b.status}{b.mentorName ? ` · Mentor: ${b.mentorName}` : " · No mentor yet"}
                  </div>
                </div>
                {b.status === "confirmed" && (
                  <AssignMentor bookingId={b.id} mentors={mentorRows} currentMentorId={b.mentorId} />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
