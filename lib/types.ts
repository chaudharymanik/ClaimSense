// Shared types for the OPD Claim Adjudication engine.
// ClaimInput mirrors the shape of test_cases.json's `input_data`, plus a set
// of clearly-marked optional fields used to make rejection codes/scenarios
// that the 10 provided test cases never exercise reachable and unit-testable
// (see Memory.md Part 2 items 17-19 in the plan for why these exist).

export interface PrescriptionDoc {
  doctor_name?: string;
  doctor_reg?: string;
  diagnosis?: string;
  medicines_prescribed?: string[];
  procedures?: string[];
  treatment?: string;
  tests_prescribed?: string[];
}

/** Bill line items: arbitrary amount keys (consultation_fee, medicines, root_canal, ...) plus optional metadata. */
export type BillDoc = Record<string, number | string[] | undefined> & {
  test_names?: string[];
};

export interface ClaimDocuments {
  prescription?: PrescriptionDoc;
  bill?: BillDoc;
}

export interface ClaimInput {
  member_id: string;
  member_name: string;
  member_join_date?: string;
  treatment_date: string;
  claim_amount: number;
  hospital?: string;
  cashless_request?: boolean;
  previous_claims_same_day?: number;
  documents: ClaimDocuments;

  // --- Supplementary fields (not in test_cases.json) for reachability of
  // codes/scenarios the provided 10 cases don't exercise. All optional,
  // all default to "nothing wrong" when omitted, documented in README assumptions. ---
  submission_date?: string;
  illegible_documents?: boolean;
  patient_name_on_documents?: string;
  document_dates?: string[];
  duplicate_of_claim_id?: string;
  prior_claims_total_ytd?: number;
  member_covered?: boolean;
  provider_blacklisted?: boolean;
}

export type Category =
  | "consultation"
  | "diagnostics"
  | "pharmacy"
  | "dental"
  | "vision"
  | "alternative_medicine"
  | "excluded"
  | "other";

export const REJECTION_CODES = [
  // Category 1: Eligibility
  "POLICY_INACTIVE",
  "WAITING_PERIOD",
  "MEMBER_NOT_COVERED",
  // Category 2: Documentation
  "MISSING_DOCUMENTS",
  "ILLEGIBLE_DOCUMENTS",
  "INVALID_PRESCRIPTION",
  "DOCTOR_REG_INVALID",
  "DATE_MISMATCH",
  "PATIENT_MISMATCH",
  // Category 3: Coverage
  "SERVICE_NOT_COVERED",
  "EXCLUDED_CONDITION",
  "PRE_AUTH_MISSING",
  // Category 4: Limits
  "ANNUAL_LIMIT_EXCEEDED",
  "SUB_LIMIT_EXCEEDED",
  "PER_CLAIM_EXCEEDED",
  // Category 5: Medical
  "NOT_MEDICALLY_NECESSARY",
  "EXPERIMENTAL_TREATMENT",
  "COSMETIC_PROCEDURE",
  // Category 6: Process
  "LATE_SUBMISSION",
  "DUPLICATE_CLAIM",
  "BELOW_MIN_AMOUNT",
] as const;

export type RejectionCode = (typeof REJECTION_CODES)[number];

export interface RuleTrailItem {
  step: string;
  passed: boolean;
  message: string;
}

export interface LineItemResult {
  key: string;
  label: string;
  amount: number;
  category: Category;
  covered: boolean;
  reasonCode?: RejectionCode;
  reasonMessage?: string;
}

export type DecisionType = "APPROVED" | "REJECTED" | "PARTIAL" | "MANUAL_REVIEW";

export interface Decision {
  claim_id: string;
  decision: DecisionType;
  approved_amount: number | null;
  deductions?: Record<string, number>;
  rejection_reasons: RejectionCode[];
  rejected_items: string[];
  flags: string[];
  cashless_approved?: boolean;
  network_discount?: number;
  confidence_score: number;
  notes: string;
  next_steps: string;
  trail: RuleTrailItem[];
}
