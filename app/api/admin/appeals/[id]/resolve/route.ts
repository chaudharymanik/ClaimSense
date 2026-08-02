import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { handleRouteError } from "@/lib/api/handleRouteError";

const ResolveAppealSchema = z
  .object({
    status: z.enum(["UPHELD", "OVERTURNED"]),
    resolutionNote: z.string().min(1).max(1000),
    overrideAmount: z.number().int().nonnegative().optional(),
  })
  .refine((data) => data.status !== "OVERTURNED" || data.overrideAmount !== undefined, {
    message: "overrideAmount is required when overturning a decision",
  });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
  }
  const parsed = ResolveAppealSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const appeal = await prisma.appeal.findUnique({
      where: { id },
      select: { id: true, status: true, claimId: true, claim: { select: { claimAmount: true } } },
    });
    if (!appeal) {
      return NextResponse.json({ error: "Appeal not found" }, { status: 404 });
    }
    if (appeal.status !== "PENDING") {
      return NextResponse.json({ error: `This appeal was already resolved (${appeal.status})` }, { status: 409 });
    }

    const { status, resolutionNote, overrideAmount } = parsed.data;

    // Same invariant as the rules engine's own bill-reconciliation check —
    // an appeal can never approve more than the claimant originally
    // submitted, regardless of what an admin types into this form.
    if (status === "OVERTURNED" && overrideAmount! > appeal.claim.claimAmount) {
      return NextResponse.json(
        { error: `overrideAmount (₹${overrideAmount}) cannot exceed the submitted claim amount (₹${appeal.claim.claimAmount})` },
        { status: 400 },
      );
    }

    await prisma.$transaction([
      prisma.appeal.update({
        where: { id },
        data: { status, resolutionNote, overrideAmount: status === "OVERTURNED" ? overrideAmount : null, resolvedAt: new Date() },
      }),
      // The original Decision row is never touched — it stays the
      // permanent, honest record of what the deterministic engine actually
      // decided. Only the claim's effective status changes on overturn, so
      // list/dashboard views reflect the real outcome.
      ...(status === "OVERTURNED"
        ? [prisma.claim.update({ where: { id: appeal.claimId }, data: { status: "APPROVED" } })]
        : []),
    ]);

    return NextResponse.json({ success: true });
  } catch (err) {
    return handleRouteError("POST /api/admin/appeals/:id/resolve", err);
  }
}
