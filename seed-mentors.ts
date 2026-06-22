import { config } from "dotenv"; config({ path: ".env.local" });
// Seed the interview-prep mentor roster. Edit the MENTORS list below with your real
// senior professionals and their Cal.com event links, then run:
//   pnpm tsx seed-mentors.ts
// `calLink` is the Cal event path under your instance (NEXT_PUBLIC_CAL_ORIGIN),
// e.g. "amaka/interview-prep" for https://your-cal/amaka/interview-prep.
// Re-running updates an existing mentor (matched by calLink) instead of duplicating.

const MENTORS = [
  {
    name: "Amaka Obi",
    title: "Staff Engineer, ex fintech",
    bio: "Ten years across backend and platform teams. Runs mock interviews for system design and behavioral rounds.",
    expertise: ["System design", "Backend", "Behavioral"],
    photoUrl: null as string | null,
    calLink: "amaka/interview-prep",
    sortOrder: 1,
  },
  {
    name: "Tunde Bello",
    title: "Engineering Manager",
    bio: "Hiring manager who has run hundreds of loops. Helps you tell your story and handle tough questions calmly.",
    expertise: ["Behavioral", "Leadership", "Frontend"],
    photoUrl: null as string | null,
    calLink: "tunde/interview-prep",
    sortOrder: 2,
  },
];

(async () => {
  const { db } = await import("./lib/db");
  const { mentors } = await import("./lib/db/schema");
  const { eq } = await import("drizzle-orm");

  for (const m of MENTORS) {
    const existing = await db.query.mentors.findFirst({ where: eq(mentors.calLink, m.calLink) });
    if (existing) {
      await db.update(mentors).set({ ...m, active: true }).where(eq(mentors.id, existing.id));
      console.log(`updated ${m.name}`);
    } else {
      await db.insert(mentors).values({ ...m, active: true });
      console.log(`inserted ${m.name}`);
    }
  }
  console.log("mentor roster seeded.");
  process.exit(0);
})();
