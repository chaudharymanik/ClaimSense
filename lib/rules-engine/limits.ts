import type { Category, ClaimInput, LineItemResult, RejectionCode } from "@/lib/types";
import type { PolicyTerms } from "./policy";

export interface HardLimitResult {
  passed: boolean;
  code?: RejectionCode;
  message: string;
}

/**
 * Per-claim limit is a hard cutoff: TC003 (₹7,500 claim, ₹5,000 per-claim limit)
 * expects a full REJECTED, not a partial approval up to the limit. Sub-limits
 * (below) behave differently — "approve up to limit" per adjudication_rules.md's
 * Special Scenarios section — so this is deliberately not the same code path.
 */
export function checkPerClaimLimit(claim: ClaimInput, policy: PolicyTerms): HardLimitResult {
  if (claim.claim_amount > policy.coverage_details.per_claim_limit) {
    return {
      passed: false,
      code: "PER_CLAIM_EXCEEDED",
      message: `Claim amount exceeds per-claim limit of ₹${policy.coverage_details.per_claim_limit}`,
    };
  }
  return { passed: true, message: "Within per-claim limit." };
}

export function checkAnnualLimit(claim: ClaimInput, policy: PolicyTerms): HardLimitResult {
  const ytd = claim.prior_claims_total_ytd ?? 0;
  if (ytd + claim.claim_amount > policy.coverage_details.annual_limit) {
    return {
      passed: false,
      code: "ANNUAL_LIMIT_EXCEEDED",
      message: `Prior claims this year (₹${ytd}) plus this claim (₹${claim.claim_amount}) exceed the annual limit of ₹${policy.coverage_details.annual_limit}.`,
    };
  }
  return { passed: true, message: "Within annual limit." };
}

const SUB_LIMIT_BY_CATEGORY: Partial<Record<Category, keyof PolicyTerms["coverage_details"]>> = {
  consultation: "consultation_fees",
  diagnostics: "diagnostic_tests",
  pharmacy: "pharmacy",
  dental: "dental",
  vision: "vision",
  alternative_medicine: "alternative_medicine",
};

export interface SubLimitAdjustment {
  category: Category;
  billedTotal: number;
  approvedTotal: number;
  exceeded: boolean;
  subLimit: number;
}

/** Caps each category's covered-item total at its policy sub-limit; excess becomes a rejected amount, not a full reject. */
export function applySubLimits(items: LineItemResult[], policy: PolicyTerms): SubLimitAdjustment[] {
  const covered = items.filter((i) => i.covered);
  const byCategory = new Map<Category, number>();
  for (const item of covered) {
    byCategory.set(item.category, (byCategory.get(item.category) ?? 0) + item.amount);
  }

  const adjustments: SubLimitAdjustment[] = [];
  for (const [category, billedTotal] of byCategory) {
    const policyKey = SUB_LIMIT_BY_CATEGORY[category];
    if (!policyKey) continue;
    const subLimit = (policy.coverage_details[policyKey] as { sub_limit: number }).sub_limit;
    const approvedTotal = Math.min(billedTotal, subLimit);
    adjustments.push({ category, billedTotal, approvedTotal, exceeded: billedTotal > subLimit, subLimit });
  }
  return adjustments;
}

export interface DeductionResult {
  deductionAmount: number;
  deductionLabel: "copay" | "network_discount" | null;
  cashlessApproved: boolean;
}

/**
 * Copay/network-discount base: TC001's ₹150 copay is 10% of the claim TOTAL
 * (₹1,500), not just the ₹1,000 consultation line item, and TC010's network
 * discount similarly resolves to 20% of the total (₹4,500). Both are applied
 * to the whole approved total, not per line item (documented assumption).
 *
 * copay_percentage only exists under consultation_fees in policy_terms.json,
 * so it (and the network_discount, defined in the same block) only apply
 * when the claim's primary category is "consultation" — TC006 (alternative
 * medicine) has a "consultation_fee" bill line but is approved in full with
 * no deduction, confirming copay is keyed off primary category, not the
 * presence of a consultation_fee line item.
 */
export function computeDeduction(
  claim: ClaimInput,
  policy: PolicyTerms,
  primaryCategory: Category,
  approvedTotal: number,
): DeductionResult {
  if (primaryCategory !== "consultation") {
    return { deductionAmount: 0, deductionLabel: null, cashlessApproved: false };
  }

  const isNetwork = !!claim.hospital && policy.network_hospitals.includes(claim.hospital);

  if (isNetwork) {
    const discount = Math.round(approvedTotal * (policy.coverage_details.consultation_fees.network_discount / 100));
    const cashlessApproved =
      !!claim.cashless_request &&
      policy.cashless_facilities.available &&
      claim.claim_amount <= policy.cashless_facilities.instant_approval_limit;
    return { deductionAmount: discount, deductionLabel: "network_discount", cashlessApproved };
  }

  const copay = Math.round(approvedTotal * (policy.coverage_details.consultation_fees.copay_percentage / 100));
  return { deductionAmount: copay, deductionLabel: "copay", cashlessApproved: false };
}
