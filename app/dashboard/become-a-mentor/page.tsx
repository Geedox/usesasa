import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { Clock, CheckCircle2, XCircle } from "lucide-react";
import { getSession } from "@/lib/get-session";
import { db } from "@/lib/db";
import { mentorApplications, mentors } from "@/lib/db/schema";
import { MentorApply } from "@/components/dashboard/mentor-apply";
import { BackButton } from "@/components/dashboard/back-button";

export default async function BecomeMentorPage() {
  const session = await getSession();
  if (!session) return null;
  const userId = session.user.id;

  const [latest] = await db
    .select()
    .from(mentorApplications)
    .where(eq(mentorApplications.userId, userId))
    .orderBy(desc(mentorApplications.createdAt))
    .limit(1);

  const isMentor = await db.query.mentors.findFirst({
    where: eq(mentors.userId, userId),
  });

  return (
    <main className="max-w-[1400px] mx-auto px-6 lg:px-10 py-8 pb-16">
      <div className="mb-4">
        <BackButton />
      </div>
      <div className="mb-6">
        <h1 className="font-display text-2xl mb-1">Become a mentor</h1>
        <p className="text-sm text-muted-foreground">
          Get Paid to help others get the job. Take mock interviews, give honest
          feedback, and score candidates out of 100. We assign you to candidates
          that match your expertise.
        </p>
      </div>

      {isMentor && (
        <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
          <div className="flex-1 text-sm text-emerald-900">
            You are an approved mentor.
          </div>
          <Link
            href="/dashboard/mentor"
            className="rounded-lg bg-foreground text-background px-4 h-9 inline-flex items-center text-sm hover:bg-foreground/90"
          >
            Open mentor dashboard
          </Link>
        </div>
      )}

      {latest?.status === "pending" && (
        <div className="rounded-xl border border-foreground/10 bg-background p-5 flex items-start gap-3">
          <Clock className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <div className="font-medium">Your application is under review</div>
            <p className="text-sm text-muted-foreground">
              We will let you know by email and Telegram once it is reviewed.
            </p>
          </div>
        </div>
      )}

      {latest?.status === "rejected" && (
        <>
          <div className="mb-6 rounded-xl border border-rose-200 bg-rose-50 p-5 flex items-start gap-3">
            <XCircle className="h-5 w-5 text-rose-500 shrink-0 mt-0.5" />
            <div>
              <div className="font-medium text-rose-900">
                Your last application was not approved
              </div>
              {latest.rejectionReason && (
                <p className="text-sm text-rose-800 mt-1 whitespace-pre-wrap">
                  {latest.rejectionReason}
                </p>
              )}
              <p className="text-sm text-rose-800/80 mt-2">
                You can address the feedback and apply again below.
              </p>
            </div>
          </div>
          <MentorApply
            defaults={{
              photoUrl: latest.photoUrl ?? "",
              resumeUrl: latest.resumeUrl ?? "",
              linkedinUrl: latest.linkedinUrl ?? "",
              otherLinks: (latest.otherLinks ?? []).join(", "),
              pitch: latest.pitch ?? "",
            }}
          />
        </>
      )}

      {!isMentor &&
        latest?.status !== "pending" &&
        latest?.status !== "rejected" && (
          <MentorApply
            defaults={{
              photoUrl: "",
              resumeUrl: "",
              linkedinUrl: "",
              otherLinks: "",
              pitch: "",
            }}
          />
        )}
    </main>
  );
}
