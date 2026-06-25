import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/get-session";
import { db } from "@/lib/db";
import { creditLedger, mentors, users } from "@/lib/db/schema";
import { DashboardSidebar } from "@/components/dashboard/sidebar";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  // Must finish onboarding before using the dashboard; resume the wizard otherwise.
  const me = await db.query.users.findFirst({ where: eq(users.id, session.user.id), columns: { onboardedAt: true } });
  if (!me?.onboardedAt) redirect("/onboarding");

  // Credit balance from the ledger (placeholder: defaults to the 5 free-trial credits).
  const rows = await db
    .select({ delta: creditLedger.delta })
    .from(creditLedger)
    .where(eq(creditLedger.userId, session.user.id));
  const balance = rows.reduce((sum, r) => sum + r.delta, 0);
  const credits = rows.length > 0 ? balance : 5;

  // Approved mentors get a Mentor dashboard link in the sidebar.
  const mentor = await db.query.mentors.findFirst({ where: eq(mentors.userId, session.user.id) });

  return (
    <div className="flex min-h-screen bg-[#f6f7f8]">
      <DashboardSidebar name={session.user.name ?? ""} email={session.user.email} credits={credits} isMentor={!!mentor} />
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
