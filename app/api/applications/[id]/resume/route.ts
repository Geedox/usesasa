import { and, eq } from "drizzle-orm";
import { getSession } from "@/lib/get-session";
import { db } from "@/lib/db";
import { applications } from "@/lib/db/schema";
import { generateResumePdf } from "@/lib/resume-pdf";

// Download the tailored resume as a PDF (owner only).
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return new Response("Not authenticated.", { status: 401 });
  const { id } = await params;

  const app = await db.query.applications.findFirst({
    where: and(eq(applications.id, id), eq(applications.userId, session.user.id)),
  });
  if (!app) return new Response("Not found.", { status: 404 });

  const pdf = await generateResumePdf(id);
  if (!pdf) return new Response("Could not generate the resume.", { status: 422 });

  return new Response(new Uint8Array(pdf.buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${pdf.filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
