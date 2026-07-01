import { NextResponse } from "next/server";
import { getSession } from "@/lib/get-session";
import { isGmailActive, listJobMessages } from "@/lib/integrations/gmail";

// Live list of the user's recent job-related emails (read from Gmail, not stored).
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const active = await isGmailActive(session.user.id);
  if (!active) return NextResponse.json({ connected: false, messages: [] });

  const messages = await listJobMessages(session.user.id);
  return NextResponse.json({ connected: true, email: session.user.email, messages });
}
