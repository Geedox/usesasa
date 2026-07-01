import { NextResponse } from "next/server";
import { getSession } from "@/lib/get-session";
import { uploadResume } from "@/lib/cloudinary";

const MAX_BYTES = 10 * 1024 * 1024; // 10MB
const ALLOWED = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

// Upload a resume file for a mentor application. Returns a URL the applicant's form
// stores (and the admin opens during review).
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file provided." }, { status: 400 });
  if (!ALLOWED.has(file.type)) return NextResponse.json({ error: "Upload a PDF or Word document." }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "File is larger than 10MB." }, { status: 400 });

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const { url } = await uploadResume(buffer, file.type, session.user.id);
    return NextResponse.json({ ok: true, url });
  } catch (err) {
    console.error("[mentor-applications/resume] upload failed:", err);
    return NextResponse.json({ error: "Upload failed. Please try again." }, { status: 502 });
  }
}
