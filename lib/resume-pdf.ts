import PDFDocument from "pdfkit";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { applications, profiles, preferences } from "@/lib/db/schema";
import { normalizeProfile } from "@/lib/profile";

type Role = { company: string; title: string; originalTitle?: string; rewrittenBullets: string[] };

// Build a clean PDF of the tailored resume: the candidate's real profile with the
// tailored (rewritten) bullets. Returns null if there's nothing to render.
export async function generateResumePdf(applicationId: string): Promise<{ buffer: Buffer; filename: string } | null> {
  const app = await db.query.applications.findFirst({ where: eq(applications.id, applicationId) });
  if (!app) return null;
  const profileRow = await db.query.profiles.findFirst({
    where: and(eq(profiles.userId, app.userId), eq(profiles.isCurrent, true)),
  });
  if (!profileRow?.parsedData) return null;
  const profile = normalizeProfile(profileRow.parsedData);

  const prefs = await db.query.preferences.findFirst({ where: eq(preferences.userId, app.userId) });
  const ob = (prefs?.onboarding ?? {}) as {
    contact?: { phone?: string; linkedin?: string; github?: string; portfolio?: string };
    location?: { city?: string; country?: string };
  };
  const contact = ob.contact ?? {};

  const cv = app.tailoredCv as { experience?: Role[]; summary?: string; skills?: string[] } | null;
  const tailored = (cv?.experience ?? []).filter((r) => r.rewrittenBullets?.length);
  const summary = cv?.summary || profile.summary;
  const skills = cv?.skills?.length ? cv.skills : profile.skills;

  const dateFor = (company: string, origTitle?: string) => {
    const e =
      profile.experience.find(
        (x) => x.company.toLowerCase() === company.toLowerCase() && (!origTitle || x.title.toLowerCase() === origTitle.toLowerCase()),
      ) ?? profile.experience.find((x) => x.company.toLowerCase() === company.toLowerCase());
    return e && (e.start || e.end) ? `${e.start} to ${e.end}` : "";
  };

  const city = ob.location?.city || profile.location?.city;
  const country = ob.location?.country || profile.location?.country;
  const contactLine = [
    profile.email,
    profile.phone || contact.phone,
    [city, country].filter(Boolean).join(", "),
    profile.links.linkedin || contact.linkedin,
    profile.links.github || contact.github,
    profile.links.portfolio || contact.portfolio,
  ]
    .filter(Boolean)
    .join("    |    ");

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () =>
      resolve({ buffer: Buffer.concat(chunks), filename: `${(profile.full_name || "resume").replace(/\s+/g, "_")}.pdf` }),
    );
    doc.on("error", reject);

    const right = 545;
    const section = (title: string) => {
      doc.moveDown(0.7);
      doc.fontSize(11).font("Helvetica-Bold").fillColor("#111111").text(title.toUpperCase());
      doc.moveTo(50, doc.y + 1).lineTo(right, doc.y + 1).strokeColor("#cccccc").lineWidth(0.5).stroke();
      doc.moveDown(0.4);
    };

    doc.fontSize(22).font("Helvetica-Bold").fillColor("#111111").text(profile.full_name || "Your Name");
    if (contactLine) doc.moveDown(0.2).fontSize(9).font("Helvetica").fillColor("#555555").text(contactLine);

    if (summary) {
      section("Summary");
      doc.fontSize(10).font("Helvetica").fillColor("#222222").text(summary, { align: "left" });
    }

    if (tailored.length) {
      section("Experience");
      for (const r of tailored) {
        doc.fontSize(11).font("Helvetica-Bold").fillColor("#111111").text(r.title || "", { continued: !!r.company });
        if (r.company) doc.font("Helvetica").fillColor("#555555").text(`    ${r.company}`);
        const dates = dateFor(r.company, r.originalTitle);
        if (dates) doc.fontSize(9).font("Helvetica-Oblique").fillColor("#777777").text(dates);
        doc.moveDown(0.2).fontSize(10).font("Helvetica").fillColor("#222222");
        for (const b of r.rewrittenBullets) doc.text(`•  ${b}`, { indent: 6 });
        doc.moveDown(0.4);
      }
    }

    if (skills.length) {
      section("Skills");
      doc.fontSize(10).font("Helvetica").fillColor("#222222").text(skills.join(",   "));
    }

    if (profile.education.length) {
      section("Education");
      for (const e of profile.education) {
        doc.fontSize(10).font("Helvetica-Bold").fillColor("#111111").text(e.institution || "", { continued: !!(e.degree || e.field) });
        const rest = [e.degree, e.field].filter(Boolean).join(", ");
        if (rest) doc.font("Helvetica").fillColor("#555555").text(`    ${rest}`);
      }
    }

    doc.end();
  });
}
