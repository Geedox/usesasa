import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/get-session";
import { db } from "@/lib/db";
import { creditLedger } from "@/lib/db/schema";
import { DashboardSidebar } from "@/components/dashboard/sidebar";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  // Credit balance from the ledger (placeholder: defaults to the 5 free-trial credits).
  const rows = await db
    .select({ delta: creditLedger.delta })
    .from(creditLedger)
    .where(eq(creditLedger.userId, session.user.id));
  const balance = rows.reduce((sum, r) => sum + r.delta, 0);
  const credits = rows.length > 0 ? balance : 5;

  return (
    <div className="flex min-h-screen bg-[#f6f7f8]">
      <DashboardSidebar name={session.user.name ?? ""} email={session.user.email} credits={credits} />
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
