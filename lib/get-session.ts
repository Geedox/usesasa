import { headers } from "next/headers";
import { auth } from "@/lib/auth";

// Server-side session helper for route handlers and server components.
export async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}
