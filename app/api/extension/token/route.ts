import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/get-session";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { hashToken } from "@/lib/extension-auth";

const TOKEN_TTL_DAYS = 30;

// Issue (or rotate) the extension pairing token. Returns the plaintext ONCE; we store only its hash.
// The token is valid for 30 days; after that the user generates a new one.
export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const token = randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
  await db
    .update(users)
    .set({ extensionTokenHash: hashToken(token), extensionTokenExpiresAt: expiresAt })
    .where(eq(users.id, session.user.id));

  return NextResponse.json({ token, expiresAt: expiresAt.toISOString() });
}
