import { eq } from "drizzle-orm";
import { ShieldAlert } from "lucide-react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/get-session";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

export const metadata = { title: "Account suspended | Sasa" };

// Shown to a user whose account an admin has suspended. If they are not actually
// suspended, send them back to the dashboard.
export default async function SuspendedPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const me = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
    columns: { suspendedAt: true, suspendedReason: true },
  });
  if (!me?.suspendedAt) redirect("/dashboard");

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#f6f7f8] px-6">
      <div className="max-w-md w-full rounded-2xl border border-foreground/10 bg-background p-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
          <ShieldAlert className="h-6 w-6" />
        </div>
        <h1 className="font-display text-2xl tracking-tight mb-2">Account suspended</h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Your Sasa account has been suspended and paid actions are paused.
          {me.suspendedReason ? ` Reason: ${me.suspendedReason}.` : ""} If you think this is a
          mistake, reach us at{" "}
          <a href="mailto:support@usesasa.xyz" className="text-foreground underline">
            support@usesasa.xyz
          </a>
          .
        </p>
      </div>
    </main>
  );
}
