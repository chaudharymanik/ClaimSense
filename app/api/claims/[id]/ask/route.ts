import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { explainDecision } from "@/lib/llm/explainDecision";
import { handleRouteError } from "@/lib/api/handleRouteError";
import type { Decision, RejectionCode, RuleTrailItem } from "@/lib/types";

const AskSchema = z.object({ question: z.string().min(1).max(500) });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
  }
  const parsed = AskSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const claim = await prisma.claim.findUnique({ where: { id }, include: { decision: true } });
    if (!claim || !claim.decision) {
      return NextResponse.json({ error: "Claim or decision not found" }, { status: 404 });
    }

    const decision: Decision = {
      claim_id: claim.id,
      // A Decision row only ever exists once adjudication has finished, so its
      // `decision` column is never the transient "PROCESSING" claim status.
      decision: claim.decision.decision as Decision["decision"],
      approved_amount: claim.decision.approvedAmount,
      rejection_reasons: (claim.decision.rejectionReasons as RejectionCode[] | null) ?? [],
      rejected_items: (claim.decision.rejectedItems as string[] | null) ?? [],
      flags: (claim.decision.flags as string[] | null) ?? [],
      confidence_score: claim.decision.confidenceScore,
      notes: claim.decision.notes ?? "",
      next_steps: claim.decision.nextSteps ?? "",
      trail: (claim.decision.ruleTrail as unknown as RuleTrailItem[]) ?? [],
    };

    const result = await explainDecision(
      { memberName: claim.memberName, claimAmount: claim.claimAmount, decision },
      parsed.data.question,
    );

    if (!result.success) {
      // result.reason is an internal diagnostic string (timeouts, empty
      // model response, etc.) — log it for debugging, never return it to
      // the caller.
      console.error(`Ask-about-decision failed for claim ${id}: ${result.reason}`);
      return NextResponse.json(
        { error: "Couldn't generate an explanation right now. Please try again." },
        { status: 502 },
      );
    }
    return NextResponse.json({ answer: result.answer });
  } catch (err) {
    return handleRouteError("POST /api/claims/:id/ask", err);
  }
}
