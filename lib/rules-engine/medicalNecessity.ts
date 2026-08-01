import type { ClaimInput, RejectionCode } from "@/lib/types";

export interface MedicalNecessityResult {
  passed: boolean;
  code?: RejectionCode;
  message: string;
}

/**
 * Optional signal the LLM extraction layer can supply in Phase 2+ (e.g. "diagnosis
 * doesn't obviously justify the prescribed treatment"). It is advisory only —
 * per Rules.md, the LLM never makes the final call. A low/false signal here
 * lowers confidence (possibly routing to MANUAL_REVIEW via the <0.70 gate);
 * it does not by itself reject a claim.
 */
export interface MedicalNecessitySignal {
  necessary: boolean;
  reasoning?: string;
}

/**
 * Step 5: deterministic baseline check — a claim needs *some* diagnosis to
 * justify treatment. This is the ONLY hard-reject path here.
 *
 * The LLM's `llmSignal` is deliberately NOT a second reject path, even though
 * an earlier version of this function did that — it was a real bug (see
 * Memory.md): a claim with one legitimately necessary item (root canal) and
 * one cosmetic add-on (teeth whitening) got the LLM's holistic "is this bill
 * necessary?" judgment of `false` (because of the whitening line), which
 * fully rejected the whole claim before coverage.ts ever got to correctly
 * itemize it as PARTIAL. The signal is surfaced in the trail and can lower
 * confidence (engine.ts), which can route to MANUAL_REVIEW via the <0.70
 * gate — but it can't out-vote the deterministic itemization/exclusion logic.
 */
export function checkMedicalNecessity(claim: ClaimInput): MedicalNecessityResult {
  const diagnosis = claim.documents.prescription?.diagnosis?.trim();
  if (!diagnosis) {
    return {
      passed: false,
      code: "NOT_MEDICALLY_NECESSARY",
      message: "No diagnosis was provided to justify the treatment.",
    };
  }

  return { passed: true, message: "Diagnosis justifies the treatment." };
}
