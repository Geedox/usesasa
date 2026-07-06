import { desc, eq, isNull } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/lib/db";
import { feedback, users } from "@/lib/db/schema";
import { FeedbackHandledToggle } from "@/components/admin/feedback-item";

const BASE = "/admin00944452347756348ad";

export const dynamic = "force-dynamic";

function fmt(d: Date): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(d);
}

const CAT_CLS: Record<string, string> = {
  bug: "bg-rose-50 text-rose-700",
  idea: "bg-sky-50 text-sky-700",
  praise: "bg-emerald-50 text-emerald-700",
  pricing: "bg-violet-50 text-violet-700",
  other: "bg-foreground/[0.06] text-muted-foreground",
};

export default async function AdminFeedbackPage() {
  const rows = await db
    .select({
      id: feedback.id,
      category: feedback.category,
      message: feedback.message,
      page: feedback.page,
      handledAt: feedback.handledAt,
      createdAt: feedback.createdAt,
      userName: users.name,
      userEmail: users.email,
      userId: users.id,
    })
    .from(feedback)
    .innerJoin(users, eq(feedback.userId, users.id))
    .orderBy(desc(feedback.createdAt))
    .limit(300);

  // Unreviewed first, then newest.
  const sorted = [...rows].sort((a, b) => (a.handledAt ? 1 : 0) - (b.handledAt ? 1 : 0));
  const [pending] = await db.select({ id: feedback.id }).from(feedback).where(isNull(feedback.handledAt)).limit(1);

  return (
    <main className="max-w-[1100px] mx-auto px-6 lg:px-10 py-8">
      <h1 className="font-display text-2xl mb-1">Feedback</h1>
      <p className="text-sm text-muted-foreground mb-6">
        {rows.length} total{pending ? " · some still to review" : ""}
      </p>

      {sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground">No feedback yet.</p>
      ) : (
        <div className="grid gap-3">
          {sorted.map((f) => (
            <div key={f.id} className={`rounded-2xl border bg-background p-5 ${f.handledAt ? "border-foreground/10 opacity-70" : "border-foreground/20"}`}>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                {f.category && (
                  <span className={`rounded-full px-2.5 py-0.5 text-xs capitalize ${CAT_CLS[f.category] ?? CAT_CLS.other}`}>{f.category}</span>
                )}
                <Link href={`${BASE}/users/${f.userId}`} className="text-sm font-medium hover:underline">
                  {f.userName || f.userEmail}
                </Link>
                <span className="text-xs text-muted-foreground">· {fmt(f.createdAt)}</span>
                {f.page && <span className="text-xs text-muted-foreground font-mono">· {f.page}</span>}
                <span className="ml-auto">
                  <FeedbackHandledToggle id={f.id} handled={!!f.handledAt} />
                </span>
              </div>
              <p className="text-sm whitespace-pre-wrap leading-relaxed">{f.message}</p>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
