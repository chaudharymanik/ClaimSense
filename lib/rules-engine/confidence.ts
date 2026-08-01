/**
 * Confidence is tiered by how mechanical/unambiguous the deciding check was —
 * a presence/absence check (does a prescription exist?) is more certain than
 * a keyword-based category classification. These tiers are general rules
 * (documented here, not per-test-case), see Memory.md for why exact
 * confidence_score values in test_cases.json aren't asserted verbatim:
 * Rules.md's testing discipline only requires decision/approved_amount/
 * rejection_reasons to match, plus the <0.70 -> MANUAL_REVIEW gate.
 */
export const CONFIDENCE_BASE = {
  UNAMBIGUOUS_PRESENCE_CHECK: 1.0, // MISSING_DOCUMENTS, BELOW_MIN_AMOUNT, INVALID_PRESCRIPTION
  HARD_NUMERIC_LIMIT: 0.98, // PER_CLAIM_EXCEEDED, ANNUAL_LIMIT_EXCEEDED
  EXCLUSION_LIST_MATCH: 0.97, // SERVICE_NOT_COVERED / EXCLUDED_CONDITION / EXPERIMENTAL / COSMETIC (whole-claim)
  ELIGIBILITY_OR_PROCESS_CHECK: 0.95, // WAITING_PERIOD, POLICY_INACTIVE, LATE_SUBMISSION, DUPLICATE_CLAIM
  DOCUMENT_VALIDATION_ISSUE: 0.95, // DOCTOR_REG_INVALID, DATE_MISMATCH, PATIENT_MISMATCH, ILLEGIBLE, MEMBER_NOT_COVERED
  PRE_AUTH_ISSUE: 0.95,
  STANDARD_APPROVAL: 0.95,
} as const;

export const CONFIDENCE_ADJUSTMENT = {
  PARTIAL_DECISION: -0.03,
  SUB_LIMIT_APPLIED: -0.05,
  ALTERNATIVE_MEDICINE_CATEGORY: -0.05,
  NETWORK_CASHLESS: -0.02,
  AI_NECESSITY_CONCERN: -0.1, // LLM flagged a possible concern — advisory, nudges toward MANUAL_REVIEW rather than deciding outright
  FRAUD_FLAGGED: -0.3,
} as const;

export function clampConfidence(value: number): number {
  return Math.max(0.5, Math.min(1, Number(value.toFixed(2))));
}
