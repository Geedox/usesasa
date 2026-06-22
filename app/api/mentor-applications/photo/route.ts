import { NextResponse } from "next/server";
import { getSession } from "@/lib/get-session";
import { uploadImage } from "@/lib/cloudinary";

const MAX_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

// Upload a mentor applicant's profile picture. Returns a delivery URL the form
// stores and the admin sees during review.
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file provided." }, { status: 400 });
  if (!ALLOWED.has(file.type)) return NextResponse.json({ error: "Upload a JPG, PNG, WEBP or GIF." }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "Image is larger than 5MB." }, { status: 400 });

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const { url } = await uploadImage(buffer, file.type, "mentor-photos");
    return NextResponse.json({ ok: true, url });
  } catch (err) {
    console.error("[mentor-applications/photo] upload failed:", err);
    return NextResponse.json({ error: "Upload failed. Please try again." }, { status: 502 });
  }
}
