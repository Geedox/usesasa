import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/get-session";
import { db } from "@/lib/db";
import { preferences } from "@/lib/db/schema";

const ARRANGEMENTS = new Set(["remote", "hybrid", "onsite"]);

// Update work-preferences (first-class columns the matcher reads): preferred work
// arrangements, and internships-only mode. Lets existing users change what onboarding
// captured without redoing the wizard.
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const { patch } = (await req.json().catch(() => ({}))) as {
    patch?: { workArrangements?: unknown; internshipOnly?: unknown };
  };
  if (!patch || typeof patch !== "object") return NextResponse.json({ error: "Missing patch." }, { status: 400 });

  const set: { workArrangements?: string[] | null; internshipOnly?: boolean } = {};
  if ("workArrangements" in patch) {
    if (!Array.isArray(patch.workArrangements)) return NextResponse.json({ error: "Invalid arrangements." }, { status: 400 });
    const clean = [...new Set(patch.workArrangements.map(String).filter((a) => ARRANGEMENTS.has(a)))];
    set.workArrangements = clean.length ? clean : null;
  }
  if ("internshipOnly" in patch) {
    if (typeof patch.internshipOnly !== "boolean") return NextResponse.json({ error: "Invalid internshipOnly." }, { status: 400 });
    set.internshipOnly = patch.internshipOnly;
  }
  if (Object.keys(set).length === 0) return NextResponse.json({ error: "Nothing valid to update." }, { status: 400 });

  await db
    .insert(preferences)
    .values({ userId: session.user.id, ...set })
    .onConflictDoUpdate({ target: preferences.userId, set });

  return NextResponse.json({ ok: true });
}
