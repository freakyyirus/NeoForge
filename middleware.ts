import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionCookie = request.cookies.get("better-auth.session_token") || request.cookies.get("__Secure-better-auth.session_token");

  // Only protect dashboard and IDE routes
  if (pathname.startsWith("/dashboard") || pathname.startsWith("/ide")) {
    if (!sessionCookie) {
      const signInUrl = new URL("/sign-in", request.nextUrl.origin);
      return NextResponse.redirect(signInUrl);
    }
  }

  // Redirect signed in users away from sign-in or landing page
  if (sessionCookie && (pathname.startsWith("/sign-in") || pathname === "/")) {
    const dashboardUrl = new URL("/dashboard", request.nextUrl.origin);
    return NextResponse.redirect(dashboardUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/ide/:path*"],
};
