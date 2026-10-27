import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";
import { missingEnv } from "@/lib/config";

// 1. Missing configuration: show the setup page instead of letting every render throw.
// 2. Optimistic auth: no session cookie means straight to /login. A cookie that exists can still be
//    stale or forged; pages and actions verify it against the database (lib/server/access).
// Pages that need a session. Anything else falls through, so unknown URLs get the 404 page.
const PROTECTED = ["/", "/history", "/license", "/admin"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const configured = missingEnv().length === 0;
  if (pathname === "/setup") return configured ? NextResponse.redirect(new URL("/", request.url)) : NextResponse.next();
  if (!configured) return NextResponse.rewrite(new URL("/setup", request.url));

  if (PROTECTED.includes(pathname) && !getSessionCookie(request)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  // Everything except API routes, Next internals and static files.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico)$).*)"],
};
