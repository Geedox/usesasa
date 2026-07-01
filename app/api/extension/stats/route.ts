import { NextResponse } from "next/server";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { applications, jobs, companies } from "@/lib/db/schema";
import { userFromBearer } from "@/lib/extension-auth";
import { ensureSignupBonus, getBalance } from "@/lib/credits";

// Powers the extension's analytics/activity view: credit balance, counts by
// stage, and recent applications with their status.
export async function GET(req: Request) {
  const user = await userFromBearer(req);
  if (!user) return NextResponse.json({ error: "Invalid token." }, { status: 401 });

  await ensureSignupBonus(user.id);
  const balance = await getBalance(user.id);

  const byState = await db
    .select({ state: applications.state, n: sql<number>`count(*)` })
    .from(applications)
    .where(eq(applications.userId, user.id))
    .groupBy(applications.state);

  const c = (states: string[]) => byState.filter((r) => states.includes(r.state)).reduce((s, r) => s + Number(r.n), 0);
  const counts = {
    ready: c(["queued", "sending"]),
    submitted: c(["submitted"]),
    needsYou: c(["needs_user", "awaiting_review"]),
    failed: c(["failed"]),
    skipped: c(["dismissed"]),
  };

  const recentRows = await db
    .select({
      state: applications.state,
      submittedAt: applications.submittedAt,
      createdAt: applications.createdAt,
      title: jobs.title,
      company: companies.name,
    })
    .from(applications)
    .innerJoin(jobs, eq(applications.jobId, jobs.id))
    .innerJoin(companies, eq(jobs.companyId, companies.id))
    .where(eq(applications.userId, user.id))
    .orderBy(desc(applications.createdAt))
    .limit(10);

  const recent = recentRows.map((r) => ({
    company: r.company,
    title: r.title,
    state: r.state,
    at: (r.submittedAt ?? r.createdAt)?.toISOString() ?? null,
  }));

  return NextResponse.json({ balance, counts, recent });
}
