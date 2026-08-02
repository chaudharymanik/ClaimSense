import { NextResponse } from "next/server";
import { getCurrentPolicy, updatePolicyConfig } from "@/lib/db/policyConfig";
import { PolicyTermsSchema } from "@/lib/api/policySchema";
import { handleRouteError } from "@/lib/api/handleRouteError";

export async function GET() {
  try {
    const policy = await getCurrentPolicy();
    return NextResponse.json({ policy });
  } catch (err) {
    return handleRouteError("GET /api/admin/policy", err);
  }
}

export async function PUT(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
  }

  const parsed = PolicyTermsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid policy", details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    await updatePolicyConfig(parsed.data);
    return NextResponse.json({ success: true });
  } catch (err) {
    return handleRouteError("PUT /api/admin/policy", err);
  }
}
