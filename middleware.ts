import { NextRequest, NextResponse } from "next/server";
import { SESSION_BRIDGE_COOKIE, verifySessionBridgeCookie } from "@/lib/security/session-bridge";

function loginRedirect(request: NextRequest) {
  const url = request.nextUrl.clone();
  const next = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  url.pathname = "/login";
  url.search = next ? `?next=${encodeURIComponent(next)}` : "";
  return NextResponse.redirect(url);
}

function dashboardRedirect(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = "/dashboard";
  url.search = "";
  return NextResponse.redirect(url);
}

function mfaRedirect(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = "/mfa/setup";
  url.search = "";
  return NextResponse.redirect(url);
}

export async function middleware(request: NextRequest) {
  const sessionCookie = request.cookies.get(SESSION_BRIDGE_COOKIE)?.value;
  const verification = await verifySessionBridgeCookie(sessionCookie);

  if (!verification.valid || !verification.payload.emailConfirmed) {
    return loginRedirect(request);
  }

  if (request.nextUrl.pathname.startsWith("/admin")) {
    if (verification.payload.role !== "ADMIN") return dashboardRedirect(request);
    if (!verification.payload.mfaSatisfied) return mfaRedirect(request);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/editor/:path*", "/admin/:path*", "/projetos/:path*"],
};
