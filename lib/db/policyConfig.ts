import { prisma } from "@/lib/db/prisma";
import { POLICY, type PolicyTerms } from "@/lib/rules-engine/policy";

const SINGLETON_ID = "singleton";

/**
 * The policy the engine should adjudicate against right now. Reads the
 * admin-editable DB row; falls back to the static POLICY constant if the
 * row is ever missing (a fresh database, or a deleted row) so claim
 * processing never breaks because of the admin feature. Lives here, not in
 * lib/rules-engine/, because it does real I/O — the rules engine itself
 * stays a pure function that only ever receives policy data as a parameter.
 */
export async function getCurrentPolicy(): Promise<PolicyTerms> {
  const row = await prisma.policyConfig.findUnique({ where: { id: SINGLETON_ID } });
  return (row?.data as PolicyTerms | undefined) ?? POLICY;
}

export async function updatePolicyConfig(policy: PolicyTerms): Promise<void> {
  await prisma.policyConfig.upsert({
    where: { id: SINGLETON_ID },
    create: { id: SINGLETON_ID, data: policy },
    update: { data: policy },
  });
}
