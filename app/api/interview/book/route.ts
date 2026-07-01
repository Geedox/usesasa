import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getSession } from "@/lib/get-session";
import { db } from "@/lib/db";
import { interviewBookings, applications, jobs, companies } from "@/lib/db/schema";
import { getBalance, INTERVIEW_COST } from "@/lib/credits";

// Create a PENDING interview-prep booking with the job context. The user books a
// time on the shared Interview Prep calendar; the Cal.com webhook confirms it (and
// charges the 3 credits). An admin assigns the mentor afterward. We pre-check the
// balance so the booking flow can't open without credits.
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const userId = session.user.id;

  const body = (await req.json().catch(() => ({}))) as {
    applicationId?: string;
    jobTitle?: string;
    companyName?: string;
    externalJobUrl?: string;
    jobDescription?: string;
    skills?: string;
  };

  const balance = await getBalance(userId);
  if (balance < INTERVIEW_COST) {
    return NextResponse.json({ error: `You need ${INTERVIEW_COST} credits to book a session. You have ${balance}.` }, { status: 402 });
  }

  // Resolve job context: either an application already in Sasa, or free-text fields.
  let jobTitle = body.jobTitle?.trim() || null;
  let companyName = body.companyName?.trim() || null;
  let jobDescription = body.jobDescription?.trim() || null;
  let applicationId: string | null = null;

  if (body.applicationId) {
    const row = await db
      .select({ id: applications.id, title: jobs.title, company: companies.name, jd: jobs.rawJd })
      .from(applications)
      .innerJoin(jobs, eq(applications.jobId, jobs.id))
      .innerJoin(companies, eq(jobs.companyId, companies.id))
      .where(and(eq(applications.id, body.applicationId), eq(applications.userId, userId)))
      .limit(1);
    if (!row.length) return NextResponse.json({ error: "We could not find that application." }, { status: 404 });
    applicationId = row[0].id;
    jobTitle = row[0].title;
    companyName = row[0].company;
    jobDescription = jobDescription || row[0].jd || null;
  }

  if (!jobTitle && !companyName && !body.externalJobUrl) {
    return NextResponse.json({ error: "Tell us which role you are prepping for." }, { status: 400 });
  }

  const [created] = await db
    .insert(interviewBookings)
    .values({
      userId,
      applicationId,
      jobTitle,
      companyName,
      externalJobUrl: body.externalJobUrl?.trim() || null,
      jobDescription: jobDescription?.slice(0, 8000) || null,
      skills: body.skills?.trim().slice(0, 2000) || null,
      status: "pending",
    })
    .returning({ id: interviewBookings.id });

  return NextResponse.json({
    ok: true,
    bookingId: created.id,
    prefill: { name: session.user.name ?? "", email: session.user.email },
  });
}
