import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSession } from "@/lib/get-session";
import { uploadCv } from "@/lib/cloudinary";
import { db } from "@/lib/db";
import { profiles } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { enqueueParseCv } from "@/lib/queue";

const MAX_BYTES = 10 * 1024 * 1024; // 10MB

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const form = await req.formData();
  const file = form.get("file");

  // A manually-typed referral code goes into the same sasa_ref cookie the ?ref= link
  // uses, so it's redeemed for the referrer when this user finishes onboarding.
  const referralCode = form.get("referralCode");
  if (typeof referralCode === "string" && /^[A-Za-z0-9]{4,12}$/.test(referralCode.trim())) {
    (await cookies()).set("sasa_ref", referralCode.trim().toUpperCase(), { maxAge: 60 * 60 * 24 * 30, path: "/", sameSite: "lax" });
  }

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided." }, { status: 400 });
  }
  if (file.type !== "application/pdf") {
    return NextResponse.json({ error: "Please upload a PDF." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File is larger than 10MB." }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const { publicId } = await uploadCv(buffer, file.type, session.user.id);

    // Mark any prior profiles as not-current, then create the new one.
    await db.update(profiles).set({ isCurrent: false }).where(eq(profiles.userId, session.user.id));
    const [profile] = await db
      .insert(profiles)
      .values({ userId: session.user.id, cvStoragePath: publicId, isCurrent: true, parsedData: null })
      .returning({ id: profiles.id });

    // Enqueue a durable parse job — the worker processes it with retries. The user
    // fills the wizard while this runs; the sidebar polls /api/onboarding/status.
    await enqueueParseCv({ profileId: profile.id, cvPublicId: publicId });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[onboarding/cv] upload failed:", err);
    return NextResponse.json({ error: "Upload failed. Please try again." }, { status: 502 });
  }
}
