import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ADMIN_SESSION_COOKIE_NAME, SESSION_COOKIE_NAME, expectedAdminSessionToken, expectedSessionToken } from "@/lib/auth";

// Renamed from `middleware.ts` per this Next.js version — see
// node_modules/next/dist/docs/.../file-conventions/proxy.md.
// /api/auth/logout is here too (not just login) — logging out must always
// succeed, even if the session cookie is already missing/expired, rather
// than bouncing the request through the redirect below.
const PUBLIC_PATHS = ["/login", "/api/auth/login", "/api/auth/logout"];

// Reachable once past the regular gate, without (or no longer needing) the
// separate admin credential — this is how you *get* the admin credential,
// and also how you *drop* just that credential (logout) without needing it
// to still be valid to do so.
const ADMIN_LOGIN_PATHS = ["/admin/login", "/api/admin/login", "/api/admin/logout"];

function isAdminPath(pathname: string): boolean {
  return pathname.startsWith("/admin") || pathname.startsWith("/api/admin");
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (PUBLIC_PATHS.includes(pathname)) {
    return NextResponse.next();
  }

  const cookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (cookie !== expectedSessionToken()) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Regular session confirmed. Admin routes need a SECOND, independent
  // credential on top — editing policy terms or overriding an appeal is a
  // materially more consequential action than viewing/submitting claims,
  // and shouldn't be reachable with just the shared, openly-displayed demo
  // password. See lib/auth.ts.
  if (isAdminPath(pathname) && !ADMIN_LOGIN_PATHS.includes(pathname)) {
    const adminCookie = request.cookies.get(ADMIN_SESSION_COOKIE_NAME)?.value;
    if (adminCookie !== expectedAdminSessionToken()) {
      const adminLoginUrl = new URL("/admin/login", request.url);
      adminLoginUrl.searchParams.set("from", pathname);
      return NextResponse.redirect(adminLoginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  // Everything except Next's own static/image assets and the favicon — API
  // routes ARE gated (this protects claim data, not just page views).
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
