import { prisma } from "@/lib/db/prisma";
import { extractFromFile, extractFromText } from "@/lib/llm/extraction";
import { getCurrentPolicy } from "@/lib/db/policyConfig";
import { adjudicate } from "@/lib/rules-engine/engine";
import type { ClaimInput, Decision } from "@/lib/types";
import type { ClaimSubmission } from "./schemas";

export interface ProcessClaimResult {
  claimId: string;
  decision: Decision;
}

/**
 * Full pipeline: extract structured fields from the submitted document (text
 * or image/PDF), run the deterministic rules engine, persist everything.
 *
 * Per Rules.md, an extraction failure (bad API response, timeout, schema
 * validation failure) must not crash the request — it routes the claim to
 * MANUAL_REVIEW with a clear note instead, bypassing the rules engine
 * entirely since there's no reliable structured data to run it on.
 */
export async function processClaim(submission: ClaimSubmission): Promise<ProcessClaimResult> {
  const claim = await prisma.claim.create({
    data: {
      memberId: submission.member_id,
      memberName: submission.member_name,
      memberJoinDate: submission.member_join_date ? new Date(submission.member_join_date) : null,
      treatmentDate: new Date(submission.treatment_date),
      claimAmount: submission.claim_amount,
      hospital: submission.hospital,
      cashlessRequest: submission.cashless_request ?? false,
      documentText: submission.document_text,
      status: "PROCESSING",
    },
  });

  const extraction = submission.document_file_base64
    ? await extractFromFile(submission.document_file_base64, submission.document_file_mime!)
    : await extractFromText(submission.document_text!);

  if (!extraction.success) {
    const decision: Decision = {
      claim_id: claim.id,
      decision: "MANUAL_REVIEW",
      approved_amount: null,
      rejection_reasons: [],
      rejected_items: [],
      flags: ["Document extraction failed"],
      confidence_score: 0,
      notes: extraction.reason,
      next_steps: "Claims ops team will review the submitted document manually.",
      trail: [{ step: "Document Extraction", passed: false, message: extraction.reason }],
    };
    await saveDecision(claim.id, decision);
    return { claimId: claim.id, decision };
  }

  const treatmentDate = new Date(submission.treatment_date);
  const yearStart = new Date(Date.UTC(treatmentDate.getUTCFullYear(), 0, 1));
  const yearEnd = new Date(Date.UTC(treatmentDate.getUTCFullYear() + 1, 0, 1));

  // None of these are user-submitted — they're all derived from real claim
  // history, since a fraudulent/careless claimant wouldn't self-report any
  // of them accurately.
  const [previousClaimsSameDay, priorApprovedDecisions, duplicateClaim, currentPolicy] = await Promise.all([
    // Fraud signal: other claims by the same member for the same treatment date.
    prisma.claim.count({
      where: { memberId: submission.member_id, treatmentDate, id: { not: claim.id } },
    }),
    // Annual limit: sum of already-approved amounts for this member within
    // the same calendar year as this treatment (policy year starts Jan 1,
    // matching policy_terms.json's effective_date).
    prisma.decision.findMany({
      where: {
        decision: { in: ["APPROVED", "PARTIAL"] },
        claim: { memberId: submission.member_id, treatmentDate: { gte: yearStart, lt: yearEnd }, id: { not: claim.id } },
      },
      select: { approvedAmount: true },
    }),
    // Duplicate detection: an exact match on member + treatment date + claim
    // amount is a strong signal this is the same treatment claimed twice.
    prisma.claim.findFirst({
      where: { memberId: submission.member_id, treatmentDate, claimAmount: submission.claim_amount, id: { not: claim.id } },
      select: { id: true },
    }),
    // Admin-editable policy (falls back to the static POLICY constant if
    // the database row doesn't exist) — see lib/db/policyConfig.ts.
    getCurrentPolicy(),
  ]);
  const priorClaimsTotalYtd = priorApprovedDecisions.reduce((sum, d) => sum + (d.approvedAmount ?? 0), 0);

  // Below the extraction-confidence floor, treat the document as effectively
  // illegible rather than trusting whatever partial fields came back.
  const illegibleDocuments = extraction.confidence < 0.4;

  const claimInput: ClaimInput = {
    member_id: submission.member_id,
    member_name: submission.member_name,
    member_join_date: submission.member_join_date,
    treatment_date: submission.treatment_date,
    claim_amount: submission.claim_amount,
    hospital: submission.hospital,
    cashless_request: submission.cashless_request,
    previous_claims_same_day: previousClaimsSameDay,
    prior_claims_total_ytd: priorClaimsTotalYtd,
    duplicate_of_claim_id: duplicateClaim?.id,
    patient_name_on_documents: extraction.patientName,
    illegible_documents: illegibleDocuments,
    documents: extraction.documents,
  };

  const decision = adjudicate(claimInput, {
    claimId: claim.id,
    medicalNecessitySignal: extraction.medicalNecessitySignal,
    policy: currentPolicy,
  });

  await prisma.extractedData.create({
    data: {
      claimId: claim.id,
      doctorName: extraction.documents.prescription?.doctor_name,
      doctorReg: extraction.documents.prescription?.doctor_reg,
      diagnosis: extraction.documents.prescription?.diagnosis,
      medicinesPrescribed: extraction.documents.prescription?.medicines_prescribed ?? undefined,
      procedures: extraction.documents.prescription?.procedures ?? undefined,
      testsPrescribed: extraction.documents.prescription?.tests_prescribed ?? undefined,
      billedItems: extraction.documents.bill ?? undefined,
      // No separate "raw" JSON blob — it would just duplicate doctorName/
      // diagnosis/medicines/etc. a second time in the same row as their
      // already-existing named columns above, with zero readers anywhere
      // in the app. Removed as unnecessary duplication of health data
      // during the data-flow audit (see docs/DATA_FLOW_AUDIT.md).
      extractionConfidence: extraction.confidence,
    },
  });

  await saveDecision(claim.id, decision);
  return { claimId: claim.id, decision };
}

async function saveDecision(claimId: string, decision: Decision): Promise<void> {
  await prisma.$transaction([
    prisma.decision.create({
      data: {
        claimId,
        decision: decision.decision,
        approvedAmount: decision.approved_amount,
        deductions: decision.deductions ?? undefined,
        rejectionReasons: decision.rejection_reasons,
        rejectedItems: decision.rejected_items,
        flags: decision.flags,
        cashlessApproved: decision.cashless_approved ?? null,
        networkDiscount: decision.network_discount ?? null,
        ruleTrail: JSON.parse(JSON.stringify(decision.trail)),
        confidenceScore: decision.confidence_score,
        notes: decision.notes,
        nextSteps: decision.next_steps,
      },
    }),
    prisma.claim.update({ where: { id: claimId }, data: { status: decision.decision } }),
  ]);
}
