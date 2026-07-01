import { desc, ilike, or, eq, count, sum } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/lib/db";
import { users, creditLedger, paystackTransactions, applications } from "@/lib/db/schema";

const BASE = "/admin00944452347756348ad";

function naira(kobo: number): string {
  return "₦" + Math.round(kobo / 100).toLocaleString("en-NG");
}
function fmtDate(d: Date | null): string {
  return d ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(d) : "Unknown";
}

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const query = (q ?? "").trim();
  const where = query
    ? or(ilike(users.email, `%${query}%`), ilike(users.name, `%${query}%`), ilike(users.fullName, `%${query}%`))
    : undefined;

  const [rows, ledger, deposits, apps] = await Promise.all([
    db
      .select({
        id: users.id,
        name: users.name,
        fullName: users.fullName,
        email: users.email,
        createdAt: users.createdAt,
        suspendedAt: users.suspendedAt,
      })
      .from(users)
      .where(where)
      .orderBy(desc(users.createdAt))
      .limit(300),
    db.select({ userId: creditLedger.userId, bal: sum(creditLedger.delta) }).from(creditLedger).groupBy(creditLedger.userId),
    db
      .select({ userId: paystackTransactions.userId, total: sum(paystackTransactions.amountKobo), n: count() })
      .from(paystackTransactions)
      .where(eq(paystackTransactions.status, "success"))
      .groupBy(paystackTransactions.userId),
    db.select({ userId: applications.userId, n: count() }).from(applications).groupBy(applications.userId),
  ]);

  const balMap = new Map(ledger.map((r) => [r.userId, Number(r.bal ?? 0)]));
  const depMap = new Map(deposits.map((r) => [r.userId, { total: Number(r.total ?? 0), n: r.n }]));
  const appMap = new Map(apps.map((r) => [r.userId, r.n]));

  return (
    <main className="max-w-[1100px] mx-auto px-6 lg:px-10 py-8">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h1 className="font-display text-2xl">Users</h1>
        <form className="flex items-center gap-2">
          <input
            name="q"
            defaultValue={query}
            placeholder="Search name or email"
            className="w-64 rounded-lg border border-foreground/15 bg-background h-9 px-3 text-sm outline-none focus:border-foreground/40"
          />
          <button className="rounded-lg bg-foreground text-background px-4 h-9 text-sm cursor-pointer hover:bg-foreground/90">
            Search
          </button>
          {query && (
            <Link href={`${BASE}/users`} className="text-sm text-muted-foreground hover:text-foreground">
              Clear
            </Link>
          )}
        </form>
      </div>

      <p className="text-sm text-muted-foreground mb-3">
        {rows.length} user{rows.length === 1 ? "" : "s"}{query ? ` matching “${query}”` : ""}
      </p>

      <div className="rounded-2xl border border-foreground/10 bg-background overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-foreground/[0.03] text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">User</th>
              <th className="px-4 py-3 font-medium text-right">Credits</th>
              <th className="px-4 py-3 font-medium text-right">Deposited</th>
              <th className="px-4 py-3 font-medium text-right">Apps</th>
              <th className="px-4 py-3 font-medium">Joined</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => {
              const dep = depMap.get(u.id);
              return (
                <tr key={u.id} className="border-t border-foreground/5 hover:bg-foreground/[0.02]">
                  <td className="px-4 py-3">
                    <Link href={`${BASE}/users/${u.id}`} className="block">
                      <div className="font-medium">{u.name || u.fullName || "Unnamed"}</div>
                      <div className="text-xs text-muted-foreground">{u.email}</div>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{balMap.get(u.id) ?? 0}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{naira(dep?.total ?? 0)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{appMap.get(u.id) ?? 0}</td>
                  <td className="px-4 py-3 text-muted-foreground">{fmtDate(u.createdAt)}</td>
                  <td className="px-4 py-3">
                    {u.suspendedAt ? (
                      <span className="inline-flex items-center rounded-full bg-rose-50 text-rose-700 px-2.5 py-0.5 text-xs">Suspended</span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-emerald-50 text-emerald-700 px-2.5 py-0.5 text-xs">Active</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">No users found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
