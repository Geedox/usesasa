import { gte, desc, count, sum } from "drizzle-orm";
import { db } from "@/lib/db";
import { anthropicUsage } from "@/lib/db/schema";
import { estimateCostUsd } from "@/lib/anthropic-usage";

// Estimated spend, so refetch on every visit.
export const dynamic = "force-dynamic";

const usd = (n: number) => "$" + (n >= 1 ? n.toFixed(2) : n.toFixed(4));
const num = (n: number) => n.toLocaleString("en-US");
function fmtTime(d: Date): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(d);
}

type Row = { tag: string; model: string; calls: number; inTok: number; outTok: number; cost: number };

async function windowAgg(sinceMs: number): Promise<Row[]> {
  const since = new Date(Date.now() - sinceMs);
  const rows = await db
    .select({
      tag: anthropicUsage.tag,
      model: anthropicUsage.model,
      calls: count(),
      inTok: sum(anthropicUsage.inputTokens),
      outTok: sum(anthropicUsage.outputTokens),
    })
    .from(anthropicUsage)
    .where(gte(anthropicUsage.createdAt, since))
    .groupBy(anthropicUsage.tag, anthropicUsage.model);
  return rows.map((r) => {
    const inTok = Number(r.inTok ?? 0);
    const outTok = Number(r.outTok ?? 0);
    return { tag: r.tag, model: r.model, calls: Number(r.calls), inTok, outTok, cost: estimateCostUsd(r.model, inTok, outTok) };
  });
}

const HOUR = 3_600_000;

export default async function AdminUsagePage() {
  const [d1, d7, d30, recent] = await Promise.all([
    windowAgg(24 * HOUR),
    windowAgg(7 * 24 * HOUR),
    windowAgg(30 * 24 * HOUR),
    db.select().from(anthropicUsage).orderBy(desc(anthropicUsage.createdAt)).limit(40),
  ]);

  const totals = (rows: Row[]) => ({
    cost: rows.reduce((s, r) => s + r.cost, 0),
    calls: rows.reduce((s, r) => s + r.calls, 0),
  });
  const t1 = totals(d1);
  const t7 = totals(d7);
  const t30 = totals(d30);

  // Per-feature breakdown for the last 7 days (sum across models).
  const byTag = new Map<string, Row>();
  for (const r of d7) {
    const cur = byTag.get(r.tag) ?? { tag: r.tag, model: "", calls: 0, inTok: 0, outTok: 0, cost: 0 };
    cur.calls += r.calls;
    cur.inTok += r.inTok;
    cur.outTok += r.outTok;
    cur.cost += r.cost;
    byTag.set(r.tag, cur);
  }
  const tagRows = [...byTag.values()].sort((a, b) => b.cost - a.cost);

  const cards = [
    ["Last 24 hours", t1],
    ["Last 7 days", t7],
    ["Last 30 days", t30],
  ] as const;

  return (
    <main className="max-w-[1100px] mx-auto px-6 lg:px-10 py-8">
      <div className="flex items-center justify-between gap-4 mb-2">
        <h1 className="font-display text-2xl">LLM usage</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-6">
        Estimated Anthropic spend from recorded token usage. Costs are estimates based on list pricing.
      </p>

      <div className="grid gap-4 sm:grid-cols-3 mb-8">
        {cards.map(([label, t]) => (
          <div key={label} className="rounded-2xl border border-foreground/10 bg-background p-6">
            <div className="font-display text-3xl mb-1">{usd(t.cost)}</div>
            <div className="text-sm text-muted-foreground">{label}</div>
            <div className="text-xs text-muted-foreground mt-1">{num(t.calls)} calls</div>
          </div>
        ))}
      </div>

      {/* Per-feature, last 7 days */}
      <div className="rounded-2xl border border-foreground/10 bg-background overflow-hidden mb-8">
        <h2 className="font-medium px-6 pt-5 pb-3">By feature (last 7 days)</h2>
        <table className="w-full text-sm">
          <thead className="bg-foreground/[0.03] text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-6 py-2.5 font-medium">Feature</th>
              <th className="px-6 py-2.5 font-medium text-right">Calls</th>
              <th className="px-6 py-2.5 font-medium text-right">Input tokens</th>
              <th className="px-6 py-2.5 font-medium text-right">Output tokens</th>
              <th className="px-6 py-2.5 font-medium text-right">Est. cost</th>
            </tr>
          </thead>
          <tbody>
            {tagRows.map((r) => (
              <tr key={r.tag} className="border-t border-foreground/5">
                <td className="px-6 py-2.5 font-mono text-xs">{r.tag}</td>
                <td className="px-6 py-2.5 text-right tabular-nums">{num(r.calls)}</td>
                <td className="px-6 py-2.5 text-right tabular-nums">{num(r.inTok)}</td>
                <td className="px-6 py-2.5 text-right tabular-nums">{num(r.outTok)}</td>
                <td className="px-6 py-2.5 text-right tabular-nums">{usd(r.cost)}</td>
              </tr>
            ))}
            {tagRows.length === 0 && (
              <tr><td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">No usage recorded in the last 7 days.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Recent calls */}
      <div className="rounded-2xl border border-foreground/10 bg-background overflow-hidden">
        <h2 className="font-medium px-6 pt-5 pb-3">Recent calls</h2>
        <table className="w-full text-sm">
          <thead className="bg-foreground/[0.03] text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-6 py-2.5 font-medium">Time</th>
              <th className="px-6 py-2.5 font-medium">Feature</th>
              <th className="px-6 py-2.5 font-medium">Model</th>
              <th className="px-6 py-2.5 font-medium text-right">In</th>
              <th className="px-6 py-2.5 font-medium text-right">Out</th>
              <th className="px-6 py-2.5 font-medium text-right">Est. cost</th>
            </tr>
          </thead>
          <tbody>
            {recent.map((r) => (
              <tr key={r.id} className="border-t border-foreground/5">
                <td className="px-6 py-2.5 text-muted-foreground whitespace-nowrap">{fmtTime(r.createdAt)}</td>
                <td className="px-6 py-2.5 font-mono text-xs">{r.tag}</td>
                <td className="px-6 py-2.5 text-xs text-muted-foreground">{r.model.replace("claude-", "")}</td>
                <td className="px-6 py-2.5 text-right tabular-nums">{num(r.inputTokens)}</td>
                <td className="px-6 py-2.5 text-right tabular-nums">{num(r.outputTokens)}</td>
                <td className="px-6 py-2.5 text-right tabular-nums">{usd(estimateCostUsd(r.model, r.inputTokens, r.outputTokens))}</td>
              </tr>
            ))}
            {recent.length === 0 && (
              <tr><td colSpan={6} className="px-6 py-8 text-center text-muted-foreground">No calls recorded yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
