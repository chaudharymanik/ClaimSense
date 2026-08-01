import { NextResponse } from "next/server";
import { redactSecrets } from "@/lib/redact";

/**
 * Shared catch-all for unexpected route handler failures (DB outage, Gemini
 * SDK throwing outside its own try/catch, etc). Never forwards the raw error
 * to the client — a Prisma error's message can contain the connection
 * string, a file path, or query details, none of which are safe to return to
 * an unauthenticated caller. Full (but still redacted/summarized) detail
 * goes to the server log only.
 */
export function handleRouteError(routeLabel: string, err: unknown): NextResponse {
  const summary = err instanceof Error ? `${err.name}: ${err.message}` : "Unknown error";
  console.error(`${routeLabel} failed:`, redactSecrets(summary));
  return NextResponse.json(
    { error: "Internal server error", message: "Something went wrong. Please try again." },
    { status: 500 },
  );
}
