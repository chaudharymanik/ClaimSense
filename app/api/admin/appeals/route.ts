import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { handleRouteError } from "@/lib/api/handleRouteError";

// List view stays slim for the same reason the main claims list does — no
// documentText, no full decision trail. Enough context to triage which
// appeal to open next.
export async function GET() {
  try {
    const appeals = await prisma.appeal.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        reason: true,
        status: true,
        resolutionNote: true,
        overrideAmount: true,
        createdAt: true,
        resolvedAt: true,
        claim: {
          select: {
            id: true,
            memberName: true,
            claimAmount: true,
            status: true,
            decision: { select: { decision: true, rejectionReasons: true, approvedAmount: true } },
          },
        },
      },
    });
    return NextResponse.json({ appeals });
  } catch (err) {
    return handleRouteError("GET /api/admin/appeals", err);
  }
}
