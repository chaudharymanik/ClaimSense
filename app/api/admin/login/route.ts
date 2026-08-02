import { NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE_NAME, ADMIN_SESSION_MAX_AGE_SECONDS, expectedAdminSessionToken, isCorrectAdminPassword } from "@/lib/auth";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
  }

  const password = typeof body === "object" && body !== null ? (body as Record<string, unknown>).password : undefined;
  if (typeof password !== "string" || password.length === 0 || !isCorrectAdminPassword(password)) {
    return NextResponse.json({ error: "Incorrect admin password" }, { status: 401 });
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set(ADMIN_SESSION_COOKIE_NAME, expectedAdminSessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: ADMIN_SESSION_MAX_AGE_SECONDS,
    path: "/",
  });
  return response;
}
