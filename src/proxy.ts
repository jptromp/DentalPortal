import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

// Optimistic check only: redirects visitors without a session cookie away from
// protected areas. Real authorisation happens in the require* helpers.
const publicPaths = [
  "/portal/login",
  "/portal/register",
  "/portal/check-email",
  "/portal/forgot-password",
  "/admin/login",
];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (publicPaths.some((path) => pathname.startsWith(path))) {
    return NextResponse.next();
  }
  if (!getSessionCookie(request)) {
    const login = pathname.startsWith("/admin") ? "/admin/login" : "/portal/login";
    return NextResponse.redirect(new URL(login, request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/portal/:path*", "/admin/:path*"],
};
