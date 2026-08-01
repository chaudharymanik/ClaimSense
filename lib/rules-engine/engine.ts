import type {
  ClaimInput,
  Decision,
  DecisionType,
  RejectionCode,
  RuleTrailItem,
} from "@/lib/types";
import { POLICY } from "./policy";
import { checkProcess } from "./process";
import { checkEligibility } from "./eligibility";
import { checkDocuments } from "./documents";
import { checkFraud } from "./fraud";
import { checkMedicalNecessity, type MedicalNecessitySignal } from "./medicalNecessity";
import {
  checkWholeClaimExclusion,
  determinePrimaryCategory,
  itemizeBill,
} from "./coverage";
import {
  applySubLimits,
  checkAnnualLimit,
  checkPerClaimLimit,
  computeDeduction,
} from "./limits";
import { CONFIDENCE_ADJUSTMENT, CONFIDENCE_BASE, clampConfidence } from "./confidence";

function newClaimId(): string {
  return `CLM_${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
}

function rejected(
  claimId: string,
  code: RejectionCode,
  message: string,
  trail: RuleTrailItem[],
  confidenceBase: number,
): Decision {
  return {
    claim_id: claimId,
    decision: "REJECTED",
    approved_amount: 0,
    rejection_reasons: [code],
    rejected_items: [],
    flags: [],
    confidence_score: clampConfidence(confidenceBase),
    notes: message,
    next_steps: "Claim rejected. Contact claims support if you believe this is an error.",
    // Plain-language message only — the raw code is already carried
    // separately in `rejection_reasons` and shown as its own labeled pill in
    // the UI. Prefixing it here read as raw internal/debug output to a
    // normal user (caught via user testing, see Memory.md).
    trail: [...trail, { step: "Final Decision", passed: false, message }],
  };
}

/** Confidence tier for the "every billed item was excluded" full-rejection path, keyed by why. */
function tierForExclusionCode(code: RejectionCode): number {
  if (code === "PRE_AUTH_MISSING") return CONFIDENCE_BASE.PRE_AUTH_ISSUE;
  return CONFIDENCE_BASE.EXCLUSION_LIST_MATCH;
}

/**
 * Runs a claim through the full deterministic adjudication pipeline. Pure
 * function, no LLM/DB calls — per Rules.md, this is the only code allowed to
 * make the final APPROVED/REJECTED/PARTIAL/MANUAL_REVIEW call.
 *
 * `medicalNecessitySignal` is an optional advisory input from the LLM
 * extraction layer (wired in Phase 2); omitted entirely in Phase 1 tests.
 */
export function adjudicate(
  claim: ClaimInput,
  options?: { claimId?: string; medicalNecessitySignal?: MedicalNecessitySignal },
): Decision {
  const claimId = options?.claimId ?? newClaimId();
  const policy = POLICY;
  const trail: RuleTrailItem[] = [];

  const process = checkProcess(claim, policy);
  trail.push({ step: "Process Validation", passed: process.passed, message: process.message });
  if (!process.passed) {
    const base =
      process.code === "BELOW_MIN_AMOUNT"
        ? CONFIDENCE_BASE.UNAMBIGUOUS_PRESENCE_CHECK
        : CONFIDENCE_BASE.ELIGIBILITY_OR_PROCESS_CHECK;
    return rejected(claimId, process.code!, process.message, trail, base);
  }

  const eligibility = checkEligibility(claim, policy);
  trail.push({ step: "Eligibility", passed: eligibility.passed, message: eligibility.message });
  if (!eligibility.passed) {
    return rejected(claimId, eligibility.code!, eligibility.message, trail, CONFIDENCE_BASE.ELIGIBILITY_OR_PROCESS_CHECK);
  }

  const documents = checkDocuments(claim);
  trail.push({ step: "Document Validation", passed: documents.passed, message: documents.message });
  if (!documents.passed) {
    const base =
      documents.code === "MISSING_DOCUMENTS" || documents.code === "INVALID_PRESCRIPTION"
        ? CONFIDENCE_BASE.UNAMBIGUOUS_PRESENCE_CHECK
        : CONFIDENCE_BASE.DOCUMENT_VALIDATION_ISSUE;
    return rejected(claimId, documents.code!, documents.message, trail, base);
  }

  const fraud = checkFraud(claim);
  trail.push({
    step: "Fraud Check",
    passed: !fraud.flagged,
    message: fraud.flagged ? fraud.flags.join("; ") : "No fraud indicators detected.",
  });
  if (fraud.flagged) {
    const confidence = clampConfidence(CONFIDENCE_BASE.STANDARD_APPROVAL + CONFIDENCE_ADJUSTMENT.FRAUD_FLAGGED);
    return {
      claim_id: claimId,
      decision: "MANUAL_REVIEW",
      approved_amount: null,
      rejection_reasons: [],
      rejected_items: [],
      flags: fraud.flags,
      confidence_score: confidence,
      notes: "Flagged for manual review due to fraud indicators.",
      next_steps: "Claim routed to the claims ops team for manual review.",
      trail: [...trail, { step: "Final Decision", passed: false, message: "Routed to MANUAL_REVIEW: fraud indicators." }],
    };
  }

  const necessity = checkMedicalNecessity(claim);
  trail.push({ step: "Medical Necessity", passed: necessity.passed, message: necessity.message });
  if (!necessity.passed) {
    return rejected(claimId, necessity.code!, necessity.message, trail, CONFIDENCE_BASE.ELIGIBILITY_OR_PROCESS_CHECK);
  }

  // LLM signal is advisory only (Rules.md) — it adjusts confidence, it never
  // rejects. Surfaced in the trail either way so reviewers can see it.
  const llmSignal = options?.medicalNecessitySignal;
  if (llmSignal) {
    trail.push({
      step: "AI Medical Necessity Signal",
      passed: llmSignal.necessary,
      message: llmSignal.reasoning ?? (llmSignal.necessary ? "AI review found no concerns." : "AI review flagged a possible concern — advisory only, does not affect the decision below."),
    });
  }

  const wholeExclusion = checkWholeClaimExclusion(claim);
  trail.push({
    step: "Coverage - Exclusion Check",
    passed: !wholeExclusion,
    message: wholeExclusion ? wholeExclusion.message : "No named policy exclusions matched.",
  });
  if (wholeExclusion) {
    return rejected(claimId, wholeExclusion.code, wholeExclusion.message, trail, CONFIDENCE_BASE.EXCLUSION_LIST_MATCH);
  }

  const items = itemizeBill(claim, policy);
  const primaryCategory = determinePrimaryCategory(claim, items);

  // No billed items extracted at all is never a legitimate ₹0 claim — every
  // real submission bills for something. This means extraction likely
  // couldn't read the document (blurry photo, cut off, wrong angle, etc.),
  // and confidently returning APPROVED: ₹0 would be actively misleading.
  // Caught via user testing on a real (if accidentally malformed) upload —
  // see Memory.md. Route to manual review instead of guessing.
  if (items.length === 0) {
    trail.push({
      step: "Coverage - Item Classification",
      passed: false,
      message: "No billed items could be extracted from the submitted document.",
    });
    return {
      claim_id: claimId,
      decision: "MANUAL_REVIEW",
      approved_amount: null,
      rejection_reasons: [],
      rejected_items: [],
      flags: ["No billed items extracted from document"],
      confidence_score: 0.5,
      notes:
        "The submitted document didn't yield any billed line items, even though a claim amount was given. Please check the document is complete and legible, or a claims analyst will review it manually.",
      next_steps: "Claim routed to the claims ops team for manual review.",
      trail: [
        ...trail,
        { step: "Final Decision", passed: false, message: "Routed to manual review — no billed items could be read from the document." },
      ],
    };
  }

  trail.push({
    step: "Coverage - Item Classification",
    passed: true,
    message: `Primary category: ${primaryCategory}. ${items.length} billed item(s) itemized.`,
  });

  // Deterministic guard against a mismatched/manipulated extraction: the
  // itemized bill total is LLM-extracted from the submitted document, which
  // is inherently untrusted input (a garbled scan, or — more seriously — a
  // document engineered to make the model report a higher amount than what
  // the claimant actually entered in claim_amount, a real prompt-injection
  // scenario found during a security review). The payout must never be
  // driven by a number the extraction invented; a small tolerance covers
  // ordinary tax/rounding differences, anything past it goes to a human
  // instead of being silently trusted.
  const BILL_MISMATCH_TOLERANCE = 5;
  const billedTotal = items.reduce((sum, i) => sum + i.amount, 0);
  if (billedTotal > claim.claim_amount + BILL_MISMATCH_TOLERANCE) {
    trail.push({
      step: "Coverage - Bill Reconciliation",
      passed: false,
      message: `Billed items total ₹${billedTotal} exceeds the submitted claim amount of ₹${claim.claim_amount}.`,
    });
    return {
      claim_id: claimId,
      decision: "MANUAL_REVIEW",
      approved_amount: null,
      rejection_reasons: [],
      rejected_items: [],
      flags: ["Billed items total exceeds submitted claim amount"],
      confidence_score: 0.5,
      notes: `The document's billed items total ₹${billedTotal}, higher than the ₹${claim.claim_amount} claim amount submitted. This mismatch needs a human to verify the actual bill before anything is approved.`,
      next_steps: "Claim routed to the claims ops team for manual review.",
      trail: [
        ...trail,
        { step: "Final Decision", passed: false, message: "Routed to manual review — billed total exceeds submitted claim amount." },
      ],
    };
  }

  const coveredItems = items.filter((i) => i.covered);
  const excludedItems = items.filter((i) => !i.covered);

  if (items.length > 0 && coveredItems.length === 0) {
    const code = excludedItems[0]!.reasonCode ?? "SERVICE_NOT_COVERED";
    const message = excludedItems.map((i) => i.reasonMessage).join("; ");
    trail.push({ step: "Coverage - Result", passed: false, message });
    return rejected(claimId, code, message, trail, tierForExclusionCode(code));
  }

  const hasExclusions = excludedItems.length > 0;

  // Per-claim/annual limits apply to the gross claim only when nothing was
  // excluded — see limits.ts and README assumptions for why (TC002/TC007
  // both exceed the per-claim limit yet are correctly PARTIAL/rejected for
  // their own item-level reasons, not PER_CLAIM_EXCEEDED).
  if (!hasExclusions) {
    const perClaim = checkPerClaimLimit(claim, policy);
    trail.push({ step: "Per-Claim Limit", passed: perClaim.passed, message: perClaim.message });
    if (!perClaim.passed) {
      return rejected(claimId, perClaim.code!, perClaim.message, trail, CONFIDENCE_BASE.HARD_NUMERIC_LIMIT);
    }

    const annual = checkAnnualLimit(claim, policy);
    trail.push({ step: "Annual Limit", passed: annual.passed, message: annual.message });
    if (!annual.passed) {
      return rejected(claimId, annual.code!, annual.message, trail, CONFIDENCE_BASE.HARD_NUMERIC_LIMIT);
    }
  }

  const subLimitAdjustments = applySubLimits(coveredItems, policy);
  const otherItemsTotal = coveredItems
    .filter((i) => i.category === "other")
    .reduce((sum, i) => sum + i.amount, 0);
  const approvedTotal =
    subLimitAdjustments.reduce((sum, a) => sum + a.approvedTotal, 0) + otherItemsTotal;
  const subLimitExceeded = subLimitAdjustments.some((a) => a.exceeded);
  const subLimitMessages = subLimitAdjustments
    .filter((a) => a.exceeded)
    .map((a) => `${a.category} capped at ₹${a.subLimit} sub-limit (billed ₹${a.billedTotal})`);
  trail.push({
    step: "Sub-Limits",
    passed: !subLimitExceeded,
    message: subLimitExceeded ? subLimitMessages.join("; ") : `All categories within sub-limits (₹${approvedTotal} covered).`,
  });

  const deduction = computeDeduction(claim, policy, primaryCategory, approvedTotal);
  const finalApproved = approvedTotal - deduction.deductionAmount;
  trail.push({
    step: "Deductions",
    passed: true,
    message: deduction.deductionLabel
      ? `${deduction.deductionLabel} of ₹${deduction.deductionAmount} applied to ₹${approvedTotal}.`
      : "No copay/network discount applies for this category.",
  });

  const rejectedItemLabels = [
    ...excludedItems.map((i) => i.reasonMessage ?? i.label),
    ...subLimitMessages,
  ];
  const rejectionCodes = new Set<RejectionCode>(
    excludedItems.map((i) => i.reasonCode).filter((c): c is RejectionCode => !!c),
  );
  if (subLimitExceeded) rejectionCodes.add("SUB_LIMIT_EXCEEDED");

  const isPartial = hasExclusions || subLimitExceeded;
  const decisionType: DecisionType = isPartial ? "PARTIAL" : "APPROVED";

  let confidence: number = CONFIDENCE_BASE.STANDARD_APPROVAL;
  if (primaryCategory === "alternative_medicine") confidence += CONFIDENCE_ADJUSTMENT.ALTERNATIVE_MEDICINE_CATEGORY;
  if (deduction.deductionLabel === "network_discount") confidence += CONFIDENCE_ADJUSTMENT.NETWORK_CASHLESS;
  if (isPartial) confidence += CONFIDENCE_ADJUSTMENT.PARTIAL_DECISION;
  if (subLimitExceeded) confidence += CONFIDENCE_ADJUSTMENT.SUB_LIMIT_APPLIED;
  if (llmSignal && !llmSignal.necessary) confidence += CONFIDENCE_ADJUSTMENT.AI_NECESSITY_CONCERN;
  confidence = clampConfidence(confidence);

  if (confidence < 0.7) {
    return {
      claim_id: claimId,
      decision: "MANUAL_REVIEW",
      approved_amount: null,
      rejection_reasons: Array.from(rejectionCodes),
      rejected_items: rejectedItemLabels,
      flags: ["Low confidence decision"],
      confidence_score: confidence,
      notes: "Automated confidence fell below the 0.70 threshold; routed for manual review.",
      next_steps: "Claim routed to the claims ops team for manual review.",
      trail: [...trail, { step: "Final Decision", passed: false, message: "Routed to MANUAL_REVIEW: confidence below 0.70." }],
    };
  }

  const deductions =
    deduction.deductionLabel === "copay" ? { copay: deduction.deductionAmount } : undefined;

  return {
    claim_id: claimId,
    decision: decisionType,
    approved_amount: finalApproved,
    deductions,
    rejection_reasons: Array.from(rejectionCodes),
    rejected_items: rejectedItemLabels,
    flags: [],
    cashless_approved: deduction.cashlessApproved || undefined,
    network_discount: deduction.deductionLabel === "network_discount" ? deduction.deductionAmount : undefined,
    confidence_score: confidence,
    notes: isPartial
      ? `Partially approved. Excluded: ${rejectedItemLabels.join("; ")}`
      : "Claim approved in full.",
    next_steps: isPartial
      ? "Review excluded items; the approved portion will be disbursed."
      : "Approved amount will be disbursed.",
    trail: [...trail, { step: "Final Decision", passed: true, message: `${decisionType}: ₹${finalApproved}` }],
  };
}
