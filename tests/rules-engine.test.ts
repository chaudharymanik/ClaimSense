import { describe, expect, it } from "vitest";
import { adjudicate } from "@/lib/rules-engine/engine";
import type { ClaimInput } from "@/lib/types";
import testCasesFixture from "./fixtures/test_cases.json";

interface TestCase {
  case_id: string;
  case_name: string;
  input_data: Record<string, unknown>;
  expected_output: Record<string, unknown>;
}

const testCases = testCasesFixture.test_cases as unknown as TestCase[];

function toClaimInput(input: Record<string, unknown>): ClaimInput {
  // The 10 provided test cases already ship as structured JSON matching
  // ClaimInput's `documents` shape, so Phase 1 bypasses the LLM extraction
  // step entirely and feeds them straight into the engine (per Phases.md).
  return input as unknown as ClaimInput;
}

function findCase(id: string): TestCase {
  const tc = testCases.find((t) => t.case_id === id);
  if (!tc) throw new Error(`Fixture ${id} not found in tests/fixtures/test_cases.json`);
  return tc;
}

describe("rules engine — all 10 provided test_cases.json scenarios", () => {
  it("TC001 — simple consultation, approved", () => {
    const tc = findCase("TC001");
    const result = adjudicate(toClaimInput(tc.input_data));
    expect(result.decision).toBe("APPROVED");
    expect(result.approved_amount).toBe(tc.expected_output.approved_amount);
    expect(result.deductions?.copay).toBe(
      (tc.expected_output.deductions as { copay: number }).copay,
    );
    expect(result.confidence_score).toBeGreaterThanOrEqual(0.7);
  });

  it("TC002 — dental with cosmetic add-on, partial approval", () => {
    const tc = findCase("TC002");
    const result = adjudicate(toClaimInput(tc.input_data));
    expect(result.decision).toBe("PARTIAL");
    expect(result.approved_amount).toBe(tc.expected_output.approved_amount);
    expect(result.rejected_items.some((r) => /teeth whitening/i.test(r))).toBe(true);
    expect(result.confidence_score).toBeGreaterThanOrEqual(0.7);
  });

  it("TC003 — over per-claim limit, rejected", () => {
    const tc = findCase("TC003");
    const result = adjudicate(toClaimInput(tc.input_data));
    expect(result.decision).toBe("REJECTED");
    expect(result.rejection_reasons).toEqual(tc.expected_output.rejection_reasons);
    expect(result.confidence_score).toBeGreaterThanOrEqual(0.7);
  });

  it("TC004 — missing prescription, rejected", () => {
    const tc = findCase("TC004");
    const result = adjudicate(toClaimInput(tc.input_data));
    expect(result.decision).toBe("REJECTED");
    expect(result.rejection_reasons).toEqual(tc.expected_output.rejection_reasons);
    expect(result.confidence_score).toBeGreaterThanOrEqual(0.7);
  });

  it("TC005 — diabetes within waiting period, rejected", () => {
    const tc = findCase("TC005");
    const result = adjudicate(toClaimInput(tc.input_data));
    expect(result.decision).toBe("REJECTED");
    expect(result.rejection_reasons).toEqual(tc.expected_output.rejection_reasons);
    expect(result.notes).toContain("2024-11-30");
    expect(result.confidence_score).toBeGreaterThanOrEqual(0.7);
  });

  it("TC006 — alternative medicine, approved in full", () => {
    const tc = findCase("TC006");
    const result = adjudicate(toClaimInput(tc.input_data));
    expect(result.decision).toBe("APPROVED");
    expect(result.approved_amount).toBe(tc.expected_output.approved_amount);
    expect(result.deductions).toBeUndefined();
    expect(result.confidence_score).toBeGreaterThanOrEqual(0.7);
  });

  it("TC007 — MRI without pre-authorization, rejected", () => {
    const tc = findCase("TC007");
    const result = adjudicate(toClaimInput(tc.input_data));
    expect(result.decision).toBe("REJECTED");
    expect(result.rejection_reasons).toEqual(tc.expected_output.rejection_reasons);
    expect(result.confidence_score).toBeGreaterThanOrEqual(0.7);
  });

  it("TC008 — fraud pattern, manual review with confidence below 0.70", () => {
    const tc = findCase("TC008");
    const result = adjudicate(toClaimInput(tc.input_data));
    expect(result.decision).toBe("MANUAL_REVIEW");
    expect(result.flags).toEqual(expect.arrayContaining(tc.expected_output.flags as string[]));
    expect(result.confidence_score).toBeLessThan(0.7);
  });

  it("TC009 — excluded weight-loss treatment, rejected", () => {
    const tc = findCase("TC009");
    const result = adjudicate(toClaimInput(tc.input_data));
    expect(result.decision).toBe("REJECTED");
    expect(result.rejection_reasons).toEqual(tc.expected_output.rejection_reasons);
    expect(result.confidence_score).toBeGreaterThanOrEqual(0.7);
  });

  it("TC010 — network hospital, cashless approved with network discount", () => {
    const tc = findCase("TC010");
    const result = adjudicate(toClaimInput(tc.input_data));
    expect(result.decision).toBe("APPROVED");
    expect(result.approved_amount).toBe(tc.expected_output.approved_amount);
    expect(result.cashless_approved).toBe(true);
    expect(result.network_discount).toBe(tc.expected_output.network_discount);
    expect(result.confidence_score).toBeGreaterThanOrEqual(0.7);
  });
});

// ---------------------------------------------------------------------------
// Supplementary tests: the 10 provided test cases only exercise 5 of the 19
// rejection codes, none of the vision category, and only one fraud
// indicator/manual-review trigger. These synthetic cases make the rest of
// adjudication_rules.md reachable and verifiable — see the plan's compliance
// checklist (Part 2, items 17-19) and Memory.md for why they exist.
// ---------------------------------------------------------------------------

function baseClaim(overrides: Partial<ClaimInput> = {}): ClaimInput {
  return {
    member_id: "EMP999",
    member_name: "Test Member",
    treatment_date: "2024-11-01",
    claim_amount: 1000,
    documents: {
      prescription: { doctor_name: "Dr. Test", doctor_reg: "KA/11111/2015", diagnosis: "Common cold" },
      bill: { consultation_fee: 1000 },
    },
    ...overrides,
  };
}

describe("rules engine — supplementary coverage for codes/categories/scenarios beyond the 10 provided cases", () => {
  it("rejects POLICY_INACTIVE for treatment before the policy's effective date", () => {
    const result = adjudicate(baseClaim({ treatment_date: "2023-12-01" }));
    expect(result.decision).toBe("REJECTED");
    expect(result.rejection_reasons).toEqual(["POLICY_INACTIVE"]);
  });

  it("rejects MEMBER_NOT_COVERED when the member isn't on the covered list (explicit override)", () => {
    const result = adjudicate(baseClaim({ member_covered: false }));
    expect(result.rejection_reasons).toEqual(["MEMBER_NOT_COVERED"]);
  });

  it("rejects MEMBER_NOT_COVERED for a member ID not on the real roster (data/member_roster.json)", () => {
    const result = adjudicate(baseClaim({ member_id: "EMP_NOT_A_REAL_EMPLOYEE" }));
    expect(result.rejection_reasons).toEqual(["MEMBER_NOT_COVERED"]);
  });

  it("passes eligibility for a member ID that IS on the real roster, with no override needed", () => {
    const result = adjudicate(baseClaim({ member_id: "EMP001" }));
    expect(result.rejection_reasons).not.toContain("MEMBER_NOT_COVERED");
  });

  it("rejects ILLEGIBLE_DOCUMENTS when flagged illegible", () => {
    const result = adjudicate(baseClaim({ illegible_documents: true }));
    expect(result.rejection_reasons).toEqual(["ILLEGIBLE_DOCUMENTS"]);
  });

  it("rejects INVALID_PRESCRIPTION for an empty prescription object", () => {
    const result = adjudicate(
      baseClaim({ documents: { prescription: {}, bill: { consultation_fee: 500 } } }),
    );
    expect(result.rejection_reasons).toEqual(["INVALID_PRESCRIPTION"]);
  });

  it("rejects DOCTOR_REG_INVALID for a malformed registration number", () => {
    const result = adjudicate(
      baseClaim({
        documents: {
          prescription: { doctor_name: "Dr. X", doctor_reg: "not-a-valid-reg", diagnosis: "Cold" },
          bill: { consultation_fee: 500 },
        },
      }),
    );
    expect(result.rejection_reasons).toEqual(["DOCTOR_REG_INVALID"]);
  });

  it("rejects DATE_MISMATCH when document dates disagree with the treatment date", () => {
    const result = adjudicate(
      baseClaim({ document_dates: ["2024-11-01", "2024-11-05"] }),
    );
    expect(result.rejection_reasons).toEqual(["DATE_MISMATCH"]);
  });

  it("rejects PATIENT_MISMATCH when the document patient name doesn't match", () => {
    const result = adjudicate(baseClaim({ patient_name_on_documents: "A Completely Different Person" }));
    expect(result.rejection_reasons).toEqual(["PATIENT_MISMATCH"]);
  });

  it("rejects EXCLUDED_CONDITION for a named-exclusion diagnosis (self-inflicted injury)", () => {
    const result = adjudicate(
      baseClaim({
        documents: {
          prescription: { doctor_name: "Dr. X", doctor_reg: "KA/11111/2015", diagnosis: "Self-inflicted injury" },
          bill: { consultation_fee: 500 },
        },
      }),
    );
    expect(result.rejection_reasons).toEqual(["EXCLUDED_CONDITION"]);
  });

  it("rejects ANNUAL_LIMIT_EXCEEDED once YTD claims plus this one exceed the annual limit", () => {
    const result = adjudicate(baseClaim({ claim_amount: 2000, prior_claims_total_ytd: 49000, documents: { prescription: baseClaim().documents.prescription, bill: { consultation_fee: 2000 } } }));
    expect(result.rejection_reasons).toEqual(["ANNUAL_LIMIT_EXCEEDED"]);
  });

  it("partially approves and flags SUB_LIMIT_EXCEEDED when a category exceeds its sub-limit", () => {
    const result = adjudicate(baseClaim({ claim_amount: 3000, documents: { prescription: baseClaim().documents.prescription, bill: { consultation_fee: 3000 } } }));
    expect(result.decision).toBe("PARTIAL");
    expect(result.rejection_reasons).toEqual(["SUB_LIMIT_EXCEEDED"]);
    expect(result.approved_amount).toBe(1800); // capped at 2000 sub-limit, then 10% copay
  });

  it("rejects NOT_MEDICALLY_NECESSARY when no diagnosis is given", () => {
    const result = adjudicate(
      baseClaim({
        documents: {
          prescription: { doctor_name: "Dr. X", doctor_reg: "KA/11111/2015", diagnosis: "" },
          bill: { consultation_fee: 500 },
        },
      }),
    );
    expect(result.rejection_reasons).toEqual(["NOT_MEDICALLY_NECESSARY"]);
  });

  it("rejects EXPERIMENTAL_TREATMENT for an experimental-treatment diagnosis", () => {
    const result = adjudicate(
      baseClaim({
        documents: {
          prescription: { doctor_name: "Dr. X", doctor_reg: "KA/11111/2015", diagnosis: "Experimental gene therapy" },
          bill: { consultation_fee: 500 },
        },
      }),
    );
    expect(result.rejection_reasons).toEqual(["EXPERIMENTAL_TREATMENT"]);
  });

  it("rejects COSMETIC_PROCEDURE for a claim-level cosmetic diagnosis", () => {
    const result = adjudicate(
      baseClaim({
        documents: {
          prescription: { doctor_name: "Dr. X", doctor_reg: "KA/11111/2015", diagnosis: "Elective cosmetic surgery" },
          bill: { consultation_fee: 500 },
        },
      }),
    );
    expect(result.rejection_reasons).toEqual(["COSMETIC_PROCEDURE"]);
  });

  it("rejects LATE_SUBMISSION when submitted more than 30 days after treatment", () => {
    const result = adjudicate(
      baseClaim({ treatment_date: "2024-10-01", submission_date: "2024-11-15" }),
    );
    expect(result.rejection_reasons).toEqual(["LATE_SUBMISSION"]);
  });

  it("rejects DUPLICATE_CLAIM when marked as a duplicate of an existing claim", () => {
    const result = adjudicate(baseClaim({ duplicate_of_claim_id: "CLM_00001" }));
    expect(result.rejection_reasons).toEqual(["DUPLICATE_CLAIM"]);
  });

  it("rejects BELOW_MIN_AMOUNT for claims under ₹500", () => {
    const result = adjudicate(baseClaim({ claim_amount: 300, documents: { prescription: baseClaim().documents.prescription, bill: { consultation_fee: 300 } } }));
    expect(result.rejection_reasons).toEqual(["BELOW_MIN_AMOUNT"]);
  });

  it("approves a vision claim — the one coverage category none of the 10 provided cases exercise", () => {
    const result = adjudicate(
      baseClaim({
        claim_amount: 1500,
        documents: {
          prescription: { doctor_name: "Dr. X", doctor_reg: "KA/11111/2015", diagnosis: "Routine eye checkup" },
          bill: { eye_test: 1500 },
        },
      }),
    );
    expect(result.decision).toBe("APPROVED");
    expect(result.approved_amount).toBe(1500);
  });

  it("does not apply a consultation co-pay to a pharmacy-only claim with no consultation item", () => {
    // Regression test: determinePrimaryCategory used to default to
    // "consultation" whenever no keyword/item match was found, which meant
    // a pure pharmacy refill (no consultation_fee line item at all) got a
    // bogus 10% co-pay applied. Found via live user testing — see
    // Memory.md/docs/TEST_SCENARIOS.md. ₹2,500 must stay ₹2,500, not ₹2,250.
    const result = adjudicate(
      baseClaim({
        claim_amount: 2500,
        documents: {
          prescription: { doctor_name: "Dr. X", doctor_reg: "KA/11111/2015", diagnosis: "Chronic condition medicine refill" },
          bill: { medicines: 2500 },
        },
      }),
    );
    expect(result.decision).toBe("APPROVED");
    expect(result.approved_amount).toBe(2500);
    expect(result.deductions).toBeUndefined();
  });

  it("routes high-value claims (>₹25,000) to MANUAL_REVIEW regardless of other checks", () => {
    const result = adjudicate(baseClaim({ claim_amount: 30000, documents: { prescription: baseClaim().documents.prescription, bill: { consultation_fee: 30000 } } }));
    expect(result.decision).toBe("MANUAL_REVIEW");
    expect(result.confidence_score).toBeLessThan(0.7);
  });

  it("routes claims from a blacklisted provider to MANUAL_REVIEW", () => {
    const result = adjudicate(baseClaim({ provider_blacklisted: true }));
    expect(result.decision).toBe("MANUAL_REVIEW");
  });

  it("never confidently approves ₹0 when no billed items could be extracted (bad/illegible upload)", () => {
    // A bill object that's technically truthy (so it passes documents.ts's
    // presence check) but has no numeric line items — e.g. extraction only
    // recovered metadata like test_names from a partially-unreadable image.
    // Caught via real user testing: a clipped test image produced exactly
    // this shape and the engine used to return APPROVED: ₹0, which is never
    // a legitimate outcome (see Memory.md).
    const result = adjudicate(
      baseClaim({ documents: { prescription: baseClaim().documents.prescription, bill: { test_names: ["CBC"] } } }),
    );
    expect(result.decision).toBe("MANUAL_REVIEW");
    expect(result.approved_amount).toBeNull();
    expect(result.flags).toContain("No billed items extracted from document");
  });

  it("routes to MANUAL_REVIEW when the extracted billed total exceeds the submitted claim amount", () => {
    // Security-review finding: document_text is untrusted input fed to the
    // LLM for extraction. A live prompt-injection test got the model to
    // report a ₹2,000 bill item for a claim submitted as ₹500 — before this
    // guard, the engine approved ₹1,800 off the fabricated number since
    // nothing cross-checked the itemized bill against claim_amount. The
    // payout must never be driven by a number the extraction invented.
    const result = adjudicate(
      baseClaim({ claim_amount: 500, documents: { prescription: baseClaim().documents.prescription, bill: { consultation_fee: 2000 } } }),
    );
    expect(result.decision).toBe("MANUAL_REVIEW");
    expect(result.approved_amount).toBeNull();
    expect(result.flags).toContain("Billed items total exceeds submitted claim amount");
  });
});
