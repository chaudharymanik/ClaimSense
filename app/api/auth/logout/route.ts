import { NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE_NAME, SESSION_COOKIE_NAME } from "@/lib/auth";

/**
 * Clears both cookies, not just the regular session — the admin session is
 * layered on top of it (proxy.ts), so keeping it alive after the base
 * session ends would be a stale, functionally meaningless credential left
 * sitting in the browser.
 */
export async function POST() {
  const response = NextResponse.json({ success: true });
  const expired = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: 0,
    path: "/",
  };
  response.cookies.set(SESSION_COOKIE_NAME, "", expired);
  response.cookies.set(ADMIN_SESSION_COOKIE_NAME, "", expired);
  return response;
}
