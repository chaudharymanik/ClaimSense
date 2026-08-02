import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { handleRouteError } from "@/lib/api/handleRouteError";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const claim = await prisma.claim.findUnique({
      where: { id },
      include: { extractedData: true, decision: true, appeal: true },
    });

    if (!claim) {
      return NextResponse.json({ error: "Claim not found" }, { status: 404 });
    }

    return NextResponse.json({ claim });
  } catch (err) {
    return handleRouteError("GET /api/claims/:id", err);
  }
}
