import { desc, eq, count } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { users, creditLedger, paystackTransactions, applications, subscriptions } from "@/lib/db/schema";
import { getBalance } from "@/lib/credits";
import { UserActions } from "@/components/admin/user-actions";

const BASE = "/admin00944452347756348ad";

function naira(kobo: number): string {
  return "₦" + Math.round(kobo / 100).toLocaleString("en-NG");
}
function fmtDateTime(d: Date | null): string {
  return d
    ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(d)
    : "Unknown";
}

export default async function AdminUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const user = await db.query.users.findFirst({ where: eq(users.id, id) });
  if (!user) notFound();

  const [balance, ledger, deposits, sub, appStates] = await Promise.all([
    getBalance(id),
    db.select().from(creditLedger).where(eq(creditLedger.userId, id)).orderBy(desc(creditLedger.createdAt)).limit(50),
    db.select().from(paystackTransactions).where(eq(paystackTransactions.userId, id)).orderBy(desc(paystackTransactions.createdAt)).limit(50),
    db.query.subscriptions.findFirst({ where: eq(subscriptions.userId, id) }),
    db.select({ state: applications.state, n: count() }).from(applications).where(eq(applications.userId, id)).groupBy(applications.state),
  ]);

  const totalDeposited = deposits.filter((d) => d.status === "success").reduce((s, d) => s + d.amountKobo, 0);
  const totalApps = appStates.reduce((s, a) => s + a.n, 0);

  const facts: [string, string][] = [
    ["Email", user.email],
    ["Phone", user.phone || "Not set"],
    ["Joined", fmtDateTime(user.createdAt)],
    ["Onboarded", user.onboardedAt ? "Yes" : "No"],
    ["Referral code", user.referralCode || "None"],
    ["Telegram", user.telegramChatId ? "Linked" : "Not linked"],
    ["Plan", sub ? `${sub.planId} (${sub.status})` : "Credits (no subscription)"],
  ];

  return (
    <main className="max-w-[1100px] mx-auto px-6 lg:px-10 py-8">
      <Link href={`${BASE}/users`} className="text-sm text-muted-foreground hover:text-foreground">← Back to users</Link>

      <div className="flex flex-wrap items-center gap-3 mt-3 mb-6">
        <h1 className="font-display text-2xl">{user.name || user.fullName || "Unnamed user"}</h1>
        {user.suspendedAt ? (
          <span className="inline-flex items-center rounded-full bg-rose-50 text-rose-700 px-3 py-1 text-xs">
            Suspended{user.suspendedReason ? `: ${user.suspendedReason}` : ""}
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full bg-emerald-50 text-emerald-700 px-3 py-1 text-xs">Active</span>
        )}
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-4 mb-6">
        {[
          ["Spendable credits", String(balance)],
          ["Total deposited", naira(totalDeposited)],
          ["Successful deposits", String(deposits.filter((d) => d.status === "success").length)],
          ["Applications", String(totalApps)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-foreground/10 bg-background p-5">
            <div className="font-display text-3xl mb-1">{value}</div>
            <div className="text-sm text-muted-foreground">{label}</div>
          </div>
        ))}
      </div>

      {/* Admin actions */}
      <div className="mb-8">
        <UserActions userId={user.id} suspended={!!user.suspendedAt} />
      </div>

      {/* Facts */}
      <div className="rounded-2xl border border-foreground/10 bg-background p-6 mb-8">
        <h2 className="font-medium mb-4">Account</h2>
        <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
          {facts.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4 text-sm">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="text-right">{v}</dd>
            </div>
          ))}
        </dl>
      </div>

      {/* Applications by state */}
      {appStates.length > 0 && (
        <div className="rounded-2xl border border-foreground/10 bg-background p-6 mb-8">
          <h2 className="font-medium mb-4">Applications by state</h2>
          <div className="flex flex-wrap gap-2">
            {appStates.map((a) => (
              <span key={a.state} className="inline-flex items-center gap-2 rounded-full border border-foreground/10 px-3 py-1 text-sm">
                {a.state}<span className="tabular-nums text-muted-foreground">{a.n}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Deposit history */}
      <div className="rounded-2xl border border-foreground/10 bg-background overflow-hidden mb-8">
        <h2 className="font-medium px-6 pt-5 pb-3">Deposit history</h2>
        <table className="w-full text-sm">
          <thead className="bg-foreground/[0.03] text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-6 py-2.5 font-medium">Date</th>
              <th className="px-6 py-2.5 font-medium">Reference</th>
              <th className="px-6 py-2.5 font-medium text-right">Amount</th>
              <th className="px-6 py-2.5 font-medium text-right">Credits</th>
              <th className="px-6 py-2.5 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {deposits.map((d) => (
              <tr key={d.id} className="border-t border-foreground/5">
                <td className="px-6 py-2.5 text-muted-foreground">{fmtDateTime(d.createdAt)}</td>
                <td className="px-6 py-2.5 font-mono text-xs">{d.paystackReference}</td>
                <td className="px-6 py-2.5 text-right tabular-nums">{naira(d.amountKobo)}</td>
                <td className="px-6 py-2.5 text-right tabular-nums">{d.creditsPurchased ?? 0}</td>
                <td className="px-6 py-2.5">
                  <span className={d.status === "success" ? "text-emerald-600" : "text-muted-foreground"}>{d.status}</span>
                </td>
              </tr>
            ))}
            {deposits.length === 0 && (
              <tr><td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">No deposits yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Credit ledger */}
      <div className="rounded-2xl border border-foreground/10 bg-background overflow-hidden">
        <h2 className="font-medium px-6 pt-5 pb-3">Credit ledger</h2>
        <table className="w-full text-sm">
          <thead className="bg-foreground/[0.03] text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-6 py-2.5 font-medium">Date</th>
              <th className="px-6 py-2.5 font-medium">Reason</th>
              <th className="px-6 py-2.5 font-medium text-right">Change</th>
              <th className="px-6 py-2.5 font-medium text-right">Balance after</th>
            </tr>
          </thead>
          <tbody>
            {ledger.map((l) => (
              <tr key={l.id} className="border-t border-foreground/5">
                <td className="px-6 py-2.5 text-muted-foreground">{fmtDateTime(l.createdAt)}</td>
                <td className="px-6 py-2.5">{l.reason.replace(/_/g, " ")}</td>
                <td className={`px-6 py-2.5 text-right tabular-nums ${l.delta >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                  {l.delta >= 0 ? "+" : ""}{l.delta}
                </td>
                <td className="px-6 py-2.5 text-right tabular-nums">{l.balanceAfter}</td>
              </tr>
            ))}
            {ledger.length === 0 && (
              <tr><td colSpan={4} className="px-6 py-8 text-center text-muted-foreground">No credit activity yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
