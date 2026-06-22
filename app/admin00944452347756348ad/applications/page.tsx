import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { mentorApplications, users } from "@/lib/db/schema";
import { ApplicationReview } from "@/components/admin/application-review";

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "bg-amber-100 text-amber-700",
    approved: "bg-emerald-100 text-emerald-700",
    rejected: "bg-rose-100 text-rose-700",
  };
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${map[status] || "bg-foreground/[0.06]"}`}>{status}</span>;
}

export default async function AdminApplicationsPage() {
  const rows = await db
    .select({
      id: mentorApplications.id,
      status: mentorApplications.status,
      photoUrl: mentorApplications.photoUrl,
      resumeUrl: mentorApplications.resumeUrl,
      linkedinUrl: mentorApplications.linkedinUrl,
      otherLinks: mentorApplications.otherLinks,
      pitch: mentorApplications.pitch,
      createdAt: mentorApplications.createdAt,
      rejectionReason: mentorApplications.rejectionReason,
      applicantName: users.name,
      applicantEmail: users.email,
    })
    .from(mentorApplications)
    .innerJoin(users, eq(mentorApplications.userId, users.id))
    .orderBy(desc(mentorApplications.createdAt));

  // Pending first.
  const sorted = [...rows].sort((a, b) => (a.status === "pending" ? -1 : 0) - (b.status === "pending" ? -1 : 0));

  return (
    <main className="max-w-[1100px] mx-auto px-6 lg:px-10 py-8">
      <h1 className="font-display text-2xl mb-6">Mentor applications</h1>
      {sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground">No applications yet.</p>
      ) : (
        <div className="grid gap-4">
          {sorted.map((a) => (
            <div key={a.id} className="rounded-2xl border border-foreground/10 bg-background p-5">
              <div className="flex items-center gap-3 mb-3">
                <span className="h-11 w-11 shrink-0 overflow-hidden rounded-full bg-foreground/[0.06] flex items-center justify-center">
                  {a.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.photoUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-[10px] text-muted-foreground">No photo</span>
                  )}
                </span>
                <div className="min-w-0">
                  <div className="font-medium">{a.applicantName || a.applicantEmail}</div>
                  <div className="text-xs text-muted-foreground">{a.applicantEmail}</div>
                </div>
                <div className="ml-auto"><StatusBadge status={a.status} /></div>
              </div>

              <div className="flex flex-wrap gap-3 text-sm mb-3">
                {a.resumeUrl && <a href={a.resumeUrl} target="_blank" rel="noreferrer" className="underline">Resume</a>}
                {a.linkedinUrl && <a href={a.linkedinUrl} target="_blank" rel="noreferrer" className="underline">LinkedIn</a>}
                {(a.otherLinks ?? []).map((l) => (
                  <a key={l} href={l} target="_blank" rel="noreferrer" className="underline truncate max-w-[220px]">{l}</a>
                ))}
              </div>

              {a.pitch && <p className="text-sm text-foreground/90 whitespace-pre-wrap mb-4">{a.pitch}</p>}
              {a.status === "rejected" && a.rejectionReason && (
                <p className="text-sm text-rose-700 mb-4">Reason given: {a.rejectionReason}</p>
              )}

              {a.status === "pending" && <ApplicationReview id={a.id} />}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
