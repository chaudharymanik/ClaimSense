import type { RejectionCode } from "@/lib/types";

/**
 * Human-readable labels for display only. The raw SCREAMING_SNAKE_CASE codes
 * (from adjudication_rules.md) stay exactly as-is everywhere else — API
 * responses, the database, tests, and the LLM context in explainDecision.ts
 * — this map is purely a presentation-layer concern for the UI.
 */
const LABELS: Record<RejectionCode, string> = {
  POLICY_INACTIVE: "Policy Not Active",
  WAITING_PERIOD: "Waiting Period",
  MEMBER_NOT_COVERED: "Member Not Covered",
  MISSING_DOCUMENTS: "Missing Documents",
  ILLEGIBLE_DOCUMENTS: "Illegible Documents",
  INVALID_PRESCRIPTION: "Invalid Prescription",
  DOCTOR_REG_INVALID: "Invalid Doctor Registration",
  DATE_MISMATCH: "Date Mismatch",
  PATIENT_MISMATCH: "Patient Mismatch",
  SERVICE_NOT_COVERED: "Service Not Covered",
  EXCLUDED_CONDITION: "Excluded Condition",
  PRE_AUTH_MISSING: "Pre-Authorization Missing",
  ANNUAL_LIMIT_EXCEEDED: "Annual Limit Exceeded",
  SUB_LIMIT_EXCEEDED: "Category Limit Exceeded",
  PER_CLAIM_EXCEEDED: "Per-Claim Limit Exceeded",
  NOT_MEDICALLY_NECESSARY: "Not Medically Necessary",
  EXPERIMENTAL_TREATMENT: "Experimental Treatment",
  COSMETIC_PROCEDURE: "Cosmetic Procedure",
  LATE_SUBMISSION: "Late Submission",
  DUPLICATE_CLAIM: "Duplicate Claim",
  BELOW_MIN_AMOUNT: "Below Minimum Amount",
};

/** Falls back to a generic title-case conversion for any code not in the map (defensive, shouldn't normally hit). */
export function rejectionCodeLabel(code: string): string {
  return LABELS[code as RejectionCode] ?? code.replace(/_/g, " ").replace(/\w\S*/g, (w) => w[0]!.toUpperCase() + w.slice(1).toLowerCase());
}
