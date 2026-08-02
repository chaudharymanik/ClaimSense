import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { handleRouteError } from "@/lib/api/handleRouteError";

const AppealSubmissionSchema = z.object({ reason: z.string().min(1).max(1000) });

// Appealable outcomes only — an APPROVED claim has nothing to appeal, and a
// MANUAL_REVIEW claim is already pending human attention through the
// existing manual-review queue, not this separate workflow.
const APPEALABLE_STATUSES = ["REJECTED", "PARTIAL"] as const;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
  }
  const parsed = AppealSubmissionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const claim = await prisma.claim.findUnique({
      where: { id },
      select: { id: true, status: true, appeal: { select: { id: true } } },
    });
    if (!claim) {
      return NextResponse.json({ error: "Claim not found" }, { status: 404 });
    }
    if (!APPEALABLE_STATUSES.includes(claim.status as (typeof APPEALABLE_STATUSES)[number])) {
      return NextResponse.json(
        { error: `Only REJECTED or PARTIAL claims can be appealed (this claim is ${claim.status})` },
        { status: 400 },
      );
    }
    if (claim.appeal) {
      return NextResponse.json({ error: "An appeal already exists for this claim" }, { status: 409 });
    }

    const appeal = await prisma.appeal.create({
      data: { claimId: id, reason: parsed.data.reason },
      select: { id: true, status: true, reason: true, createdAt: true },
    });
    return NextResponse.json({ appeal }, { status: 201 });
  } catch (err) {
    return handleRouteError("POST /api/claims/:id/appeal", err);
  }
}
