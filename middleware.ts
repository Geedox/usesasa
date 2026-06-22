import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

// Two jobs:
// 1) Capture a referral code from ?ref=CODE into a 30-day cookie (consumed when the
//    referred user finishes onboarding).
// 2) Optimistic auth guard for protected paths: bounce to /login when there's no
//    session cookie (the page's getSession() is the real gate).
export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const isProtected = path.startsWith("/dashboard") || path.startsWith("/onboarding");

  const res =
    isProtected && !getSessionCookie(request)
      ? NextResponse.redirect(new URL("/login", request.url))
      : NextResponse.next();

  const ref = request.nextUrl.searchParams.get("ref");
  if (ref && /^[A-Za-z0-9]{4,12}$/.test(ref)) {
    res.cookies.set("sasa_ref", ref.toUpperCase(), { maxAge: 60 * 60 * 24 * 30, path: "/", sameSite: "lax" });
  }
  return res;
}

export const config = {
  matcher: ["/", "/login", "/dashboard/:path*", "/onboarding/:path*"],
};
