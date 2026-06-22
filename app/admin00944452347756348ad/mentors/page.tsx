import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { mentors, users } from "@/lib/db/schema";
import { MentorManager, type MentorRow } from "@/components/admin/mentor-manager";

export default async function AdminMentorsPage() {
  const rows = await db
    .select({
      id: mentors.id,
      name: mentors.name,
      title: mentors.title,
      calLink: mentors.calLink,
      expertise: mentors.expertise,
      active: mentors.active,
      userId: mentors.userId,
      userEmail: users.email,
    })
    .from(mentors)
    .leftJoin(users, eq(mentors.userId, users.id))
    .orderBy(desc(mentors.active), mentors.sortOrder, desc(mentors.createdAt));

  const list: MentorRow[] = rows.map((m) => ({
    id: m.id,
    name: m.name,
    title: m.title,
    calLink: m.calLink,
    expertise: m.expertise,
    active: m.active,
    fromApplication: false,
    linked: !!m.userId,
    userEmail: m.userEmail,
  }));

  return (
    <main className="max-w-[1100px] mx-auto px-6 lg:px-10 py-8">
      <MentorManager mentors={list} />
    </main>
  );
}
