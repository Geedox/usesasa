import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/get-session";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { telegramEnabled, getBotUsername } from "@/lib/telegram";

// Generate a one-time deep link the user taps to connect their Telegram chat.
export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  if (!telegramEnabled()) {
    return NextResponse.json({ error: "Telegram is not configured on the server." }, { status: 503 });
  }
  const username = await getBotUsername();
  if (!username) {
    return NextResponse.json({ error: "Could not reach the Telegram bot." }, { status: 502 });
  }

  const token = randomBytes(16).toString("hex");
  await db.update(users).set({ telegramLinkToken: token }).where(eq(users.id, session.user.id));

  return NextResponse.json({ url: `https://t.me/${username}?start=${token}` });
}
