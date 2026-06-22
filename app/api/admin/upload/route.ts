import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin";
import { uploadImage } from "@/lib/cloudinary";

const MAX_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

// Admin uploads an image (e.g. a mentor photo) and gets back a delivery URL.
export async function POST(req: Request) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Not authorized." }, { status: 403 });

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file provided." }, { status: 400 });
  if (!ALLOWED.has(file.type)) return NextResponse.json({ error: "Upload a JPG, PNG, WEBP or GIF." }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "Image is larger than 5MB." }, { status: 400 });

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const folder = (form.get("folder") as string) || "uploads";
    const { url } = await uploadImage(buffer, file.type, folder);
    return NextResponse.json({ ok: true, url });
  } catch (err) {
    console.error("[admin/upload] failed:", err);
    return NextResponse.json({ error: "Upload failed. Please try again." }, { status: 502 });
  }
}
