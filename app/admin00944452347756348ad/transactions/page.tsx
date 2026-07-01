import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/lib/db";
import { paystackTransactions, users } from "@/lib/db/schema";

const BASE = "/admin00944452347756348ad";

function naira(kobo: number): string {
  return "₦" + Math.round(kobo / 100).toLocaleString("en-NG");
}
function fmtDateTime(d: Date | null): string {
  return d
    ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(d)
    : "Unknown";
}

export default async function AdminTransactionsPage() {
  const rows = await db
    .select({
      id: paystackTransactions.id,
      reference: paystackTransactions.paystackReference,
      amountKobo: paystackTransactions.amountKobo,
      status: paystackTransactions.status,
      credits: paystackTransactions.creditsPurchased,
      createdAt: paystackTransactions.createdAt,
      userId: paystackTransactions.userId,
      userName: users.name,
      userEmail: users.email,
    })
    .from(paystackTransactions)
    .innerJoin(users, eq(paystackTransactions.userId, users.id))
    .orderBy(desc(paystackTransactions.createdAt))
    .limit(500);

  const success = rows.filter((r) => r.status === "success");
  const revenueKobo = success.reduce((s, r) => s + r.amountKobo, 0);
  const creditsSold = success.reduce((s, r) => s + (r.credits ?? 0), 0);

  return (
    <main className="max-w-[1100px] mx-auto px-6 lg:px-10 py-8">
      <h1 className="font-display text-2xl mb-6">Transactions</h1>

      <div className="grid gap-4 sm:grid-cols-3 mb-6">
        {[
          ["Total revenue", naira(revenueKobo)],
          ["Successful payments", String(success.length)],
          ["Credits sold", String(creditsSold)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-foreground/10 bg-background p-6">
            <div className="font-display text-3xl mb-1">{value}</div>
            <div className="text-sm text-muted-foreground">{label}</div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-foreground/10 bg-background overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-foreground/[0.03] text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">User</th>
              <th className="px-4 py-3 font-medium">Reference</th>
              <th className="px-4 py-3 font-medium text-right">Amount</th>
              <th className="px-4 py-3 font-medium text-right">Credits</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-foreground/5 hover:bg-foreground/[0.02]">
                <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{fmtDateTime(r.createdAt)}</td>
                <td className="px-4 py-3">
                  <Link href={`${BASE}/users/${r.userId}`} className="hover:underline">
                    {r.userName || r.userEmail}
                  </Link>
                </td>
                <td className="px-4 py-3 font-mono text-xs">{r.reference}</td>
                <td className="px-4 py-3 text-right tabular-nums">{naira(r.amountKobo)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{r.credits ?? 0}</td>
                <td className="px-4 py-3">
                  <span className={r.status === "success" ? "text-emerald-600" : "text-muted-foreground"}>{r.status}</span>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">No transactions yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
