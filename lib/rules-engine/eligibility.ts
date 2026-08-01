import type { ClaimInput, RejectionCode } from "@/lib/types";
import type { PolicyTerms } from "./policy";
import { addDays, formatISODate, isBefore, parseISODate } from "./dates";
import { isMemberOnRoster } from "./roster";

export interface EligibilityResult {
  passed: boolean;
  code?: RejectionCode;
  message: string;
}

/**
 * Waiting-period keyword -> policy.waiting_periods.specific_ailments key.
 * adjudication_rules.md only names three specific ailments; anything else
 * falls back to the general initial_waiting period.
 */
const AILMENT_KEYWORDS: Array<{ pattern: RegExp; ailment: "diabetes" | "hypertension" | "joint_replacement" }> = [
  { pattern: /diabet/i, ailment: "diabetes" },
  { pattern: /hypertension|high blood pressure/i, ailment: "hypertension" },
  { pattern: /joint replacement/i, ailment: "joint_replacement" },
];

function waitingPeriodDaysFor(diagnosis: string | undefined, policy: PolicyTerms): number {
  if (diagnosis) {
    for (const { pattern, ailment } of AILMENT_KEYWORDS) {
      if (pattern.test(diagnosis)) {
        return policy.waiting_periods.specific_ailments[ailment];
      }
    }
  }
  return policy.waiting_periods.initial_waiting;
}

export function checkEligibility(claim: ClaimInput, policy: PolicyTerms): EligibilityResult {
  const treatmentDate = parseISODate(claim.treatment_date);

  // Member coverage. No real HR/member database was provided by Plum, so
  // this checks against data/member_roster.json — a simulated roster (see
  // its _comment). `member_covered` remains available as an explicit
  // override for tests: `true` force-passes regardless of the roster,
  // `false` force-fails; when omitted, the roster is the real source of truth.
  if (claim.member_covered === false || (claim.member_covered === undefined && !isMemberOnRoster(claim.member_id))) {
    return {
      passed: false,
      code: "MEMBER_NOT_COVERED",
      message: `${claim.member_name} (${claim.member_id}) was not found in the covered members list.`,
    };
  }

  // Policy active: treatment must be on/after the policy's effective date.
  const effectiveDate = parseISODate(policy.effective_date);
  if (isBefore(treatmentDate, effectiveDate)) {
    return {
      passed: false,
      code: "POLICY_INACTIVE",
      message: `Policy became active on ${policy.effective_date}, before the treatment date ${claim.treatment_date}.`,
    };
  }

  // Waiting period. No member roster means no real join date for most cases;
  // absent member_join_date, we assume enrollment since the policy's own
  // effective_date (see README assumptions) so waiting periods are already
  // satisfied unless a join date is explicitly supplied (as in TC005).
  const joinDate = claim.member_join_date ? parseISODate(claim.member_join_date) : effectiveDate;
  const diagnosis = claim.documents.prescription?.diagnosis;
  const waitingDays = waitingPeriodDaysFor(diagnosis, policy);
  const eligibleFrom = addDays(joinDate, waitingDays);

  if (isBefore(treatmentDate, eligibleFrom)) {
    return {
      passed: false,
      code: "WAITING_PERIOD",
      message: `${waitingDays}-day waiting period applies${diagnosis ? ` for "${diagnosis}"` : ""}. Eligible from ${formatISODate(eligibleFrom)}.`,
    };
  }

  return { passed: true, message: "Policy active and waiting period satisfied." };
}
