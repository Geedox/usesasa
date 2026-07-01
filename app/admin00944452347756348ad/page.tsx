import { and, eq, isNull, count } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/lib/db";
import { mentorApplications, interviewBookings, mentors } from "@/lib/db/schema";

const BASE = "/admin00944452347756348ad";

export default async function AdminOverviewPage() {
  const [pendingApps] = await db
    .select({ n: count() })
    .from(mentorApplications)
    .where(eq(mentorApplications.status, "pending"));
  const [unassigned] = await db
    .select({ n: count() })
    .from(interviewBookings)
    .where(and(eq(interviewBookings.status, "confirmed"), isNull(interviewBookings.mentorId)));
  const [activeMentors] = await db.select({ n: count() }).from(mentors).where(eq(mentors.active, true));

  const cards = [
    { label: "Applications to review", value: pendingApps?.n ?? 0, href: `${BASE}/applications` },
    { label: "Calls needing a mentor", value: unassigned?.n ?? 0, href: `${BASE}/bookings` },
    { label: "Active mentors", value: activeMentors?.n ?? 0, href: `${BASE}/bookings` },
  ];

  return (
    <main className="max-w-[1100px] mx-auto px-6 lg:px-10 py-8">
      <h1 className="font-display text-2xl mb-6">Overview</h1>
      <div className="grid gap-4 sm:grid-cols-3">
        {cards.map((c) => (
          <Link key={c.label} href={c.href} className="rounded-2xl border border-foreground/10 bg-background p-6 hover:border-foreground/30 transition-colors">
            <div className="font-display text-4xl mb-1">{c.value}</div>
            <div className="text-sm text-muted-foreground">{c.label}</div>
          </Link>
        ))}
      </div>
    </main>
  );
}
