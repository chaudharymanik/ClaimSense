import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE_NAME, expectedSessionToken } from "@/lib/auth";

// Renamed from `middleware.ts` per this Next.js version — see
// node_modules/next/dist/docs/.../file-conventions/proxy.md.
const PUBLIC_PATHS = ["/login", "/api/auth/login"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (PUBLIC_PATHS.includes(pathname)) {
    return NextResponse.next();
  }

  const cookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (cookie === expectedSessionToken()) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("from", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  // Everything except Next's own static/image assets and the favicon — API
  // routes ARE gated (this protects claim data, not just page views).
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
