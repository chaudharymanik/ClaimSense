import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { processClaim } from "@/lib/api/processClaim";
import { ClaimSubmissionSchema } from "@/lib/api/schemas";
import { redactSecrets } from "@/lib/redact";
import { handleRouteError } from "@/lib/api/handleRouteError";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
  }

  const parsed = ClaimSubmissionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid claim submission", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const result = await processClaim(parsed.data);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    // This catches genuinely unexpected failures (e.g. a database outage),
    // not the "explain what went wrong" paths in extraction.ts/
    // explainDecision.ts, which are designed to be user-facing. An error
    // like a Prisma connection failure can include the connection string in
    // its message — so only a redacted name+message summary is logged
    // server-side (visible in Vercel's function logs, not to any caller),
    // never the raw error object, which could carry request-shaped data
    // (e.g. a Zod/Prisma error's `.meta`) that echoes back submitted PII.
    // The client always gets a generic message — there's no auth in front
    // of this API, so anyone can call it.
    const summary = err instanceof Error ? `${err.name}: ${err.message}` : "Unknown error";
    console.error("POST /api/claims failed:", redactSecrets(summary));
    return NextResponse.json(
      { error: "Failed to process claim", message: "Internal server error. Please try again." },
      { status: 500 },
    );
  }
}

export async function GET() {
  // List view intentionally returns a slim summary, not full records — no
  // documentText (raw pasted document, contains diagnosis), and no
  // decision.notes/ruleTrail/rejectedItems (can quote diagnosis text back,
  // e.g. the waiting-period message). Full detail — including all of the
  // above — is only ever returned by GET /api/claims/:id, a deliberate
  // per-record fetch, not a bulk listing. See docs/DATA_FLOW_AUDIT.md.
  try {
    const claims = await prisma.claim.findMany({
      select: {
        id: true,
        memberId: true,
        memberName: true,
        treatmentDate: true,
        claimAmount: true,
        status: true,
        createdAt: true,
        decision: { select: { decision: true, approvedAmount: true, confidenceScore: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 25,
    });
    return NextResponse.json({ claims });
  } catch (err) {
    return handleRouteError("GET /api/claims", err);
  }
}
