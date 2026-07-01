import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { applications, profiles, preferences } from "@/lib/db/schema";
import { userFromBearer } from "@/lib/extension-auth";
import { normalizeProfile } from "@/lib/profile";
import { generateResumePdf } from "@/lib/resume-pdf";

// Polled by the widget after queuing a tailor. Returns ready=false while the worker
// is still tailoring; once done, returns the prefill fields, cover letter, answers,
// and the tailored resume PDF (base64) for downloading + filling.
export async function GET(req: Request) {
  const user = await userFromBearer(req);
  if (!user) return NextResponse.json({ error: "Invalid token." }, { status: 401 });

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });

  const app = await db.query.applications.findFirst({ where: and(eq(applications.id, id), eq(applications.userId, user.id)) });
  if (!app) return NextResponse.json({ error: "Not found." }, { status: 404 });

  if (!app.tailoredCv) {
    // Still working, or blocked (out of credits / limit) — surface the note if any.
    const blocked = app.state === "needs_user" && app.submissionNote && /credit|limit/i.test(app.submissionNote);
    return NextResponse.json({ ready: false, blocked: !!blocked, message: blocked ? app.submissionNote : undefined });
  }

  const profileRow = await db.query.profiles.findFirst({ where: and(eq(profiles.userId, user.id), eq(profiles.isCurrent, true)) });
  const profile = profileRow?.parsedData ? normalizeProfile(profileRow.parsedData) : null;
  const prefsRow = await db.query.preferences.findFirst({ where: eq(preferences.userId, user.id) });
  const contact = (prefsRow?.onboarding as { contact?: { phone?: string; linkedin?: string; github?: string; portfolio?: string } } | null)?.contact ?? {};
  const [firstName, ...rest] = (profile?.full_name ?? user.name ?? "").trim().split(/\s+/);

  const pdf = await generateResumePdf(app.id);

  return NextResponse.json({
    ready: true,
    fields: {
      firstName: firstName ?? "",
      lastName: rest.join(" "),
      email: profile?.email ?? user.email,
      phone: profile?.phone || contact.phone || "",
      linkedin: profile?.links.linkedin || contact.linkedin || "",
      github: profile?.links.github || contact.github || "",
      portfolio: profile?.links.portfolio || contact.portfolio || "",
    },
    coverLetter: app.coverLetterText ?? "",
    answers: (app.customAnswers as Record<string, string> | null) ?? {},
    resumeBase64: pdf ? pdf.buffer.toString("base64") : null,
    resumeName: pdf?.filename ?? "cv.pdf",
  });
}
