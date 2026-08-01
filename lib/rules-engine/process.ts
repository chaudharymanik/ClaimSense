import type { ClaimInput, RejectionCode } from "@/lib/types";
import type { PolicyTerms } from "./policy";
import { daysBetween, parseISODate } from "./dates";

export interface ProcessResult {
  passed: boolean;
  code?: RejectionCode;
  message: string;
}

/** Category 6 (Process Issues) checks from adjudication_rules.md. */
export function checkProcess(claim: ClaimInput, policy: PolicyTerms): ProcessResult {
  if (claim.claim_amount < policy.claim_requirements.minimum_claim_amount) {
    return {
      passed: false,
      code: "BELOW_MIN_AMOUNT",
      message: `Claim amount ₹${claim.claim_amount} is below the minimum of ₹${policy.claim_requirements.minimum_claim_amount}.`,
    };
  }

  if (claim.duplicate_of_claim_id) {
    return {
      passed: false,
      code: "DUPLICATE_CLAIM",
      message: `This treatment was already claimed under claim ${claim.duplicate_of_claim_id}.`,
    };
  }

  if (claim.submission_date) {
    const days = daysBetween(parseISODate(claim.treatment_date), parseISODate(claim.submission_date));
    if (days > policy.claim_requirements.submission_timeline_days) {
      return {
        passed: false,
        code: "LATE_SUBMISSION",
        message: `Submitted ${days} days after treatment, exceeding the ${policy.claim_requirements.submission_timeline_days}-day deadline.`,
      };
    }
  }

  return { passed: true, message: "Claim amount, submission timing, and duplicate checks all clear." };
}
