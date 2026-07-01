import { and, eq, isNull, isNotNull, count, sum } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/lib/db";
import { mentorApplications, interviewBookings, mentors, users, paystackTransactions, applications } from "@/lib/db/schema";

const BASE = "/admin00944452347756348ad";

function naira(kobo: number): string {
  return "₦" + Math.round(kobo / 100).toLocaleString("en-NG");
}

export default async function AdminOverviewPage() {
  const [
    [totalUsers],
    [suspendedUsers],
    [totalApps],
    [submittedApps],
    [revenue],
    [pendingApps],
    [unassigned],
    [activeMentors],
  ] = await Promise.all([
    db.select({ n: count() }).from(users),
    db.select({ n: count() }).from(users).where(isNotNull(users.suspendedAt)),
    db.select({ n: count() }).from(applications),
    db.select({ n: count() }).from(applications).where(eq(applications.state, "submitted")),
    db.select({ v: sum(paystackTransactions.amountKobo) }).from(paystackTransactions).where(eq(paystackTransactions.status, "success")),
    db.select({ n: count() }).from(mentorApplications).where(eq(mentorApplications.status, "pending")),
    db.select({ n: count() }).from(interviewBookings).where(and(eq(interviewBookings.status, "confirmed"), isNull(interviewBookings.mentorId))),
    db.select({ n: count() }).from(mentors).where(eq(mentors.active, true)),
  ]);

  const business = [
    { label: "Total users", value: String(totalUsers?.n ?? 0), href: `${BASE}/users` },
    { label: "Suspended", value: String(suspendedUsers?.n ?? 0), href: `${BASE}/users` },
    { label: "Total revenue", value: naira(Number(revenue?.v ?? 0)), href: `${BASE}/transactions` },
    { label: "Applications", value: String(totalApps?.n ?? 0), href: `${BASE}/users` },
    { label: "Submitted", value: String(submittedApps?.n ?? 0), href: `${BASE}/users` },
  ];

  const ops = [
    { label: "Mentor apps to review", value: String(pendingApps?.n ?? 0), href: `${BASE}/applications` },
    { label: "Calls needing a mentor", value: String(unassigned?.n ?? 0), href: `${BASE}/bookings` },
    { label: "Active mentors", value: String(activeMentors?.n ?? 0), href: `${BASE}/mentors` },
  ];

  return (
    <main className="max-w-[1100px] mx-auto px-6 lg:px-10 py-8">
      <h1 className="font-display text-2xl mb-6">Overview</h1>

      <h2 className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Business</h2>
      <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5 mb-8">
        {business.map((c) => (
          <Link key={c.label} href={c.href} className="rounded-2xl border border-foreground/10 bg-background p-6 hover:border-foreground/30 transition-colors">
            <div className="font-display text-3xl mb-1">{c.value}</div>
            <div className="text-sm text-muted-foreground">{c.label}</div>
          </Link>
        ))}
      </div>

      <h2 className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Interview prep</h2>
      <div className="grid gap-4 sm:grid-cols-3">
        {ops.map((c) => (
          <Link key={c.label} href={c.href} className="rounded-2xl border border-foreground/10 bg-background p-6 hover:border-foreground/30 transition-colors">
            <div className="font-display text-4xl mb-1">{c.value}</div>
            <div className="text-sm text-muted-foreground">{c.label}</div>
          </Link>
        ))}
      </div>
    </main>
  );
}
