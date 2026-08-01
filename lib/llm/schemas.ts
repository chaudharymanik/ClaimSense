import { z } from "zod";

/**
 * Bill line items come back as an array (not a free-form record) because
 * structured-output schemas (both Gemini's and Zod's) handle arrays of
 * fixed-shape objects far more reliably than open-ended key maps. `key`
 * is the canonical machine-friendly identifier the rules engine's
 * `classifyItem()` (lib/rules-engine/coverage.ts) already knows how to
 * categorize (consultation_fee, root_canal, mri_scan, medicines, ...) —
 * the prompt in extraction.ts teaches the model this vocabulary.
 */
export const ExtractedBillItemSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  amount: z.number().nonnegative(),
});

// `.nullish()` (nullable AND optional) rather than `.nullable()`: Gemini's
// structured output sometimes omits a nullable field entirely instead of
// sending it as `null`, even with the key marked `required` in the response
// schema. Being strict here would route a perfectly good extraction to
// MANUAL_REVIEW over a cosmetic omission — accept either, then treat missing
// and null identically downstream (see extraction.ts's nullsToUndefined).
export const ExtractedPrescriptionSchema = z.object({
  doctor_name: z.string().nullish(),
  doctor_reg: z.string().nullish(),
  diagnosis: z.string().nullish(),
  medicines_prescribed: z.array(z.string()).nullish(),
  procedures: z.array(z.string()).nullish(),
  treatment: z.string().nullish(),
  tests_prescribed: z.array(z.string()).nullish(),
});

export const MedicalNecessitySchema = z.object({
  necessary: z.boolean(),
  reasoning: z.string(),
});

export const ExtractionResponseSchema = z.object({
  prescription: ExtractedPrescriptionSchema.nullish(),
  bill_items: z.array(ExtractedBillItemSchema).nullish(),
  test_names: z.array(z.string()).nullish(),
  // The patient's name as written ON THE DOCUMENT — kept separate from
  // ClaimInput's `documents.prescription` (which the rules engine consumes
  // for coverage classification) since this is purely for the
  // PATIENT_MISMATCH identity check against the submitted member_name, not
  // a coverage-relevant field.
  patient_name: z.string().nullish(),
  medical_necessity: MedicalNecessitySchema.nullish(),
  extraction_confidence: z.number().min(0).max(1),
  notes: z.string().nullish(),
});

export type ExtractionResponse = z.infer<typeof ExtractionResponseSchema>;
