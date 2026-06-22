import { NextResponse } from "next/server";
import { userFromBearer } from "@/lib/extension-auth";
import { scoreJobForUser } from "@/lib/matching/score";
import { canUseSasa } from "@/lib/can-use";

// Score the job currently open in the extension widget against the user's profile.
// Returns a 0-100 match percentage + a one-line reason, so the widget can show a
// ring telling the user how well this role fits before they tailor.
export async function POST(req: Request) {
  const user = await userFromBearer(req);
  if (!user) return NextResponse.json({ error: "Invalid token." }, { status: 401 });

  const can = await canUseSasa(user.id);
  if (!can.ok) return NextResponse.json({ error: can.error }, { status: 402 });

  const { title, company, jd, url } = (await req.json().catch(() => ({}))) as {
    title?: string; company?: string; jd?: string; url?: string;
  };
  if (!title && !jd) return NextResponse.json({ error: "Nothing to score." }, { status: 422 });

  try {
    const result = await scoreJobForUser(user.id, {
      title: title || "the role",
      location: "",
      rawJd: `${company ? `Company: ${company}\n` : ""}${url ? `URL: ${url}\n` : ""}${jd || ""}`,
    });
    if (!result) return NextResponse.json({ error: "Finish onboarding (upload your CV) first." }, { status: 422 });
    return NextResponse.json({ score: result.score, reason: result.reason });
  } catch {
    return NextResponse.json({ error: "Could not score." }, { status: 500 });
  }
}
