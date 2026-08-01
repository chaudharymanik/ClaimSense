import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS, expectedSessionToken, todaysDemoPassword } from "@/lib/auth";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
  }

  const password = typeof body === "object" && body !== null ? (body as Record<string, unknown>).password : undefined;
  if (typeof password !== "string" || password.length === 0 || password !== todaysDemoPassword()) {
    return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set(SESSION_COOKIE_NAME, expectedSessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE_SECONDS,
    path: "/",
  });
  return response;
}
