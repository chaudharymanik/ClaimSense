import type { ClaimInput, RejectionCode } from "@/lib/types";
import { parseISODate } from "./dates";

export interface DocumentResult {
  passed: boolean;
  code?: RejectionCode;
  message: string;
}

/**
 * Doctor registration format per sample_documents_guide.md: [State Code]/[Number]/[Year],
 * e.g. "KA/45678/2015". Alternative-medicine practitioners use an extra leading
 * segment (e.g. "AYUR/KL/2345/2019", TC006) — the format allows one or more
 * uppercase/alphanumeric segments before a mandatory trailing 4-digit year.
 */
const DOCTOR_REG_PATTERN = /^[A-Z]+(\/[A-Z0-9]+)*\/\d{4}$/;

export function checkDocuments(claim: ClaimInput): DocumentResult {
  const { prescription, bill } = claim.documents;

  if (claim.illegible_documents) {
    return {
      passed: false,
      code: "ILLEGIBLE_DOCUMENTS",
      message: "Submitted documents are not clearly readable.",
    };
  }

  if (!prescription) {
    return {
      passed: false,
      code: "MISSING_DOCUMENTS",
      message: "Prescription from registered doctor is required.",
    };
  }

  if (!bill) {
    return {
      passed: false,
      code: "MISSING_DOCUMENTS",
      message: "Original bill/receipt is required.",
    };
  }

  const hasAnyPrescriptionContent =
    prescription.doctor_name || prescription.doctor_reg || prescription.diagnosis;
  if (!hasAnyPrescriptionContent) {
    return {
      passed: false,
      code: "INVALID_PRESCRIPTION",
      message: "Prescription is missing doctor details and diagnosis.",
    };
  }

  if (!prescription.doctor_reg || !DOCTOR_REG_PATTERN.test(prescription.doctor_reg)) {
    return {
      passed: false,
      code: "DOCTOR_REG_INVALID",
      message: `Doctor registration number "${prescription.doctor_reg ?? ""}" is missing or not in the expected [State]/[Number]/[Year] format.`,
    };
  }

  if (claim.patient_name_on_documents) {
    const onFile = claim.member_name.trim().toLowerCase();
    const onDoc = claim.patient_name_on_documents.trim().toLowerCase();
    // Minor variations acceptable (adjudication_rules.md Step 2) — allow substring match either way.
    const matches = onFile.includes(onDoc) || onDoc.includes(onFile);
    if (!matches) {
      return {
        passed: false,
        code: "PATIENT_MISMATCH",
        message: `Patient name on documents ("${claim.patient_name_on_documents}") does not match policy records ("${claim.member_name}").`,
      };
    }
  }

  if (claim.document_dates && claim.document_dates.length > 0) {
    const treatment = parseISODate(claim.treatment_date).getTime();
    const mismatched = claim.document_dates.some(
      (d) => parseISODate(d).getTime() !== treatment,
    );
    if (mismatched) {
      return {
        passed: false,
        code: "DATE_MISMATCH",
        message: "Submitted documents do not all share the same treatment date.",
      };
    }
  }

  return { passed: true, message: "All documents present, legible, and consistent." };
}
