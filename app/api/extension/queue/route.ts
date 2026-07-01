import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { applications, jobs, companies, profiles, preferences } from "@/lib/db/schema";
import { userFromBearer } from "@/lib/extension-auth";
import { ensureSignupBonus, getBalance } from "@/lib/credits";
import { normalizeProfile } from "@/lib/profile";
import { cloudinary } from "@/lib/cloudinary";

// Build the URL of the application *form* (not just the posting page). Lever and
// Ashby render the posting at the stored url; the form lives at a sub-path.
function applyUrlFor(r: {
  jobUrl: string | null;
  jobSource: string;
  jobExternalId: string;
  companySlug: string | null;
}): string {
  const base = (r.jobUrl ?? "").replace(/\/$/, "");
  switch (r.jobSource) {
    case "greenhouse":
      return base || `https://boards.greenhouse.io/${r.companySlug}/jobs/${r.jobExternalId}`;
    case "lever": {
      const url = base || `https://jobs.lever.co/${r.companySlug}/${r.jobExternalId}`;
      return /\/apply$/.test(url) ? url : `${url}/apply`;
    }
    case "ashby": {
      const url = base || `https://jobs.ashbyhq.com/${r.companySlug}/${r.jobExternalId}`;
      return /\/application$/.test(url) ? url : `${url}/application`;
    }
    default:
      return base;
  }
}

export async function GET(req: Request) {
  const user = await userFromBearer(req);
  if (!user) return NextResponse.json({ error: "Invalid token." }, { status: 401 });

  await ensureSignupBonus(user.id);
  const balance = await getBalance(user.id);
  if (balance <= 0) return NextResponse.json({ balance, applications: [] });

  const profileRow = await db.query.profiles.findFirst({
    where: and(eq(profiles.userId, user.id), eq(profiles.isCurrent, true)),
  });
  const profile = profileRow?.parsedData ? normalizeProfile(profileRow.parsedData) : null;
  const resumeUrl = profileRow?.cvStoragePath
    ? cloudinary.url(profileRow.cvStoragePath, { resource_type: "raw", type: "authenticated", sign_url: true, secure: true })
    : null;
  const [firstName, ...rest] = (profile?.full_name ?? user.name ?? "").trim().split(/\s+/);

  // Onboarding contact details (the user entered these in the wizard) — used as a
  // fallback when the parsed CV did not include them.
  const prefsRow = await db.query.preferences.findFirst({ where: eq(preferences.userId, user.id) });
  const contact = (prefsRow?.onboarding as { contact?: { phone?: string; linkedin?: string; github?: string; portfolio?: string } } | null)?.contact ?? {};

  const rows = await db
    .select({
      id: applications.id,
      coverLetterText: applications.coverLetterText,
      customAnswers: applications.customAnswers,
      jobUrl: jobs.url,
      jobExternalId: jobs.externalId,
      jobSource: jobs.source,
      jobTitle: jobs.title,
      companyName: companies.name,
      companySlug: companies.atsSlug,
    })
    .from(applications)
    .innerJoin(jobs, eq(applications.jobId, jobs.id))
    .innerJoin(companies, eq(jobs.companyId, companies.id))
    .where(and(eq(applications.userId, user.id), eq(applications.state, "queued")))
    .limit(balance); // never queue more than the user can pay for

  const fields = {
    firstName: firstName ?? "",
    lastName: rest.join(" "),
    email: profile?.email ?? user.email,
    phone: profile?.phone || contact.phone || "",
    linkedin: profile?.links.linkedin || contact.linkedin || "",
    github: profile?.links.github || contact.github || "",
    portfolio: profile?.links.portfolio || contact.portfolio || "",
  };

  const apps = rows.map((r) => ({
    id: r.id,
    company: r.companyName,
    title: r.jobTitle,
    applyUrl: applyUrlFor(r),
    fields,
    resumeUrl,
    coverLetter: r.coverLetterText ?? "",
    answers: r.customAnswers ?? {},
  }));

  console.log(`[extension] queue user=${user.id} balance=${balance} returning=${apps.length} apps`);
  return NextResponse.json({ balance, applications: apps });
}
