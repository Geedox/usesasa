import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/get-session";
import { db } from "@/lib/db";
import { mentors, users } from "@/lib/db/schema";
import { getBalance, ensureSignupBonus } from "@/lib/credits";
import { DashboardSidebar } from "@/components/dashboard/sidebar";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  // Must finish onboarding before using the dashboard; resume the wizard otherwise.
  const me = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
    columns: { onboardedAt: true, suspendedAt: true },
  });
  // Suspended accounts can't reach the dashboard.
  if (me?.suspendedAt) redirect("/suspended");
  if (!me?.onboardedAt) redirect("/onboarding");

  // Grant the free-trial credits once (backfills anyone created before the signup hook),
  // then read the real balance from the ledger.
  await ensureSignupBonus(session.user.id).catch(() => {});
  const credits = await getBalance(session.user.id);

  // Approved mentors get a Mentor dashboard link in the sidebar.
  const mentor = await db.query.mentors.findFirst({ where: eq(mentors.userId, session.user.id) });

  return (
    <div className="flex min-h-screen bg-[#f6f7f8]">
      <DashboardSidebar name={session.user.name ?? ""} email={session.user.email} credits={credits} isMentor={!!mentor} />
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
