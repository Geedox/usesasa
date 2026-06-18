import { createHash } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// Resolve the user from the extension's `Authorization: Bearer <pairing-token>`.
// Returns null if the token is unknown or expired (tokens last 30 days).
export async function userFromBearer(req: Request) {
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return null;
  const user = await db.query.users.findFirst({ where: eq(users.extensionTokenHash, hashToken(token)) });
  if (!user) return null;
  if (user.extensionTokenExpiresAt && user.extensionTokenExpiresAt.getTime() < Date.now()) {
    console.warn(`[extension] token expired for user ${user.id}`);
    return null;
  }
  return user;
}
