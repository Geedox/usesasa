import { NextResponse } from "next/server";
import { getSession } from "@/lib/get-session";
import { getMessageBody } from "@/lib/integrations/gmail";

// Full body of one inbox message (read live; not stored).
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const { id } = await params;

  const msg = await getMessageBody(session.user.id, id);
  if (!msg) return NextResponse.json({ error: "Message not found." }, { status: 404 });
  return NextResponse.json(msg);
}
