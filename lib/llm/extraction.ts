import { Type, type Schema } from "@google/genai";
import type { BillDoc, ClaimDocuments, PrescriptionDoc } from "@/lib/types";
import type { MedicalNecessitySignal } from "@/lib/rules-engine/medicalNecessity";
import { getClient, withTimeout, MODEL } from "./client";
import { ExtractionResponseSchema, type ExtractionResponse } from "./schemas";
import { redactSecrets } from "@/lib/redact";

export type ExtractionResult =
  | {
      success: true;
      documents: ClaimDocuments;
      medicalNecessitySignal: MedicalNecessitySignal | undefined;
      /** Patient name as written on the document, for the PATIENT_MISMATCH identity check — see schemas.ts. */
      patientName: string | undefined;
      confidence: number;
      notes: string | null;
    }
  | { success: false; reason: string };

// Mirrors classifyItem()'s regex vocabulary in lib/rules-engine/coverage.ts —
// keep these in sync so extracted bill items land in the category the rules
// engine already knows how to handle.
const CANONICAL_BILL_KEYS = [
  "consultation_fee",
  "diagnostic_tests",
  "medicines",
  "root_canal",
  "extraction",
  "filling",
  "cleaning",
  "teeth_whitening",
  "therapy_charges",
  "mri_scan",
  "ct_scan",
  "x_ray",
  "ultrasound",
  "ecg",
  "eye_test",
  "glasses",
  "contact_lens",
  "lasik_surgery",
  "diet_plan",
] as const;

const PRESCRIPTION_SCHEMA: Schema = {
  type: Type.OBJECT,
  nullable: true,
  properties: {
    doctor_name: { type: Type.STRING, nullable: true },
    doctor_reg: { type: Type.STRING, nullable: true },
    diagnosis: { type: Type.STRING, nullable: true },
    medicines_prescribed: { type: Type.ARRAY, nullable: true, items: { type: Type.STRING } },
    procedures: { type: Type.ARRAY, nullable: true, items: { type: Type.STRING } },
    treatment: { type: Type.STRING, nullable: true },
    tests_prescribed: { type: Type.ARRAY, nullable: true, items: { type: Type.STRING } },
  },
  // All keys required (each individually nullable) so the model always emits
  // them — Gemini will otherwise sometimes drop a nullable key entirely
  // instead of sending it as null. schemas.ts's Zod types tolerate omission
  // too (defense in depth), but forcing this here reduces how often it happens.
  required: [
    "doctor_name",
    "doctor_reg",
    "diagnosis",
    "medicines_prescribed",
    "procedures",
    "treatment",
    "tests_prescribed",
  ],
};

const RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    prescription: PRESCRIPTION_SCHEMA,
    bill_items: {
      type: Type.ARRAY,
      nullable: true,
      items: {
        type: Type.OBJECT,
        properties: {
          key: { type: Type.STRING },
          label: { type: Type.STRING },
          amount: { type: Type.NUMBER },
        },
        required: ["key", "label", "amount"],
      },
    },
    test_names: { type: Type.ARRAY, nullable: true, items: { type: Type.STRING } },
    patient_name: { type: Type.STRING, nullable: true },
    medical_necessity: {
      type: Type.OBJECT,
      nullable: true,
      properties: {
        necessary: { type: Type.BOOLEAN },
        reasoning: { type: Type.STRING },
      },
      required: ["necessary", "reasoning"],
    },
    extraction_confidence: { type: Type.NUMBER },
    notes: { type: Type.STRING, nullable: true },
  },
  required: [
    "prescription",
    "bill_items",
    "test_names",
    "patient_name",
    "medical_necessity",
    "extraction_confidence",
    "notes",
  ],
};

const PROMPT = `You are extracting structured data from an Indian OPD (outpatient) insurance claim document — a prescription and/or a medical bill. The document may be typed text or a photographed/scanned image or PDF.

Extract:
- prescription: doctor_name, doctor_reg (format like "KA/45678/2015", or a practice-type-prefixed variant like "AYUR/KL/2345/2019" for Ayurveda/Homeopathy/Unani practitioners), diagnosis, medicines_prescribed, procedures, treatment, tests_prescribed. Use null for any field not present in the document — do not invent values.
- bill_items: every billed line item with an amount. For each item give a machine-friendly snake_case "key" describing what it is, a human-readable "label", and the numeric "amount". Prefer these canonical keys when they fit: ${CANONICAL_BILL_KEYS.join(", ")}. If none fit, invent a clear snake_case key.
- test_names: if diagnostic tests were billed, list their specific names (e.g. "CBC", "Dengue test") separately from bill_items.
- patient_name: the patient's name exactly as written on the document (prescription or bill) — this is used to confirm the document is actually for the person filing the claim, separately from anything else you extract. Null if no patient name appears anywhere.
- medical_necessity: your judgment on whether the diagnosis reasonably justifies the PRIMARY treatment (the main reason for the visit). Ignore incidental/cosmetic add-on items (e.g. teeth whitening alongside a root canal) — policy coverage rules handle those separately; don't let an unrelated add-on make you call the core treatment unnecessary. This is ADVISORY ONLY — you are not deciding the claim, a separate deterministic system does that.
- extraction_confidence: 0-1, how confident you are in this extraction. Lower it for illegible handwriting, blurry images, ambiguous or missing fields — do not default to a high number out of habit.
- notes: anything a human reviewer should know about extraction quality (e.g. "doctor signature illegible", "bill total didn't reconcile with line items").

Respond with JSON matching the provided schema only.`;

/** Zod's schema uses `null` for "not present in the document"; ClaimInput's optional fields use `undefined`. */
function nullsToUndefined<T extends object>(obj: T): { [K in keyof T]: Exclude<T[K], null> | undefined } {
  const result = {} as { [K in keyof T]: Exclude<T[K], null> | undefined };
  for (const key of Object.keys(obj) as (keyof T)[]) {
    const value = obj[key];
    result[key] = (value === null ? undefined : value) as Exclude<T[typeof key], null> | undefined;
  }
  return result;
}

function toClaimDocuments(parsed: ExtractionResponse): ClaimDocuments {
  const bill: BillDoc = parsed.bill_items
    ? Object.fromEntries(parsed.bill_items.map((item) => [item.key, item.amount]))
    : {};
  if (parsed.test_names) {
    bill.test_names = parsed.test_names;
  }

  return {
    prescription: parsed.prescription
      ? (nullsToUndefined(parsed.prescription) as PrescriptionDoc)
      : undefined,
    bill: Object.keys(bill).length > 0 ? bill : undefined,
  };
}

function toResult(parsed: ExtractionResponse): ExtractionResult {
  return {
    success: true,
    documents: toClaimDocuments(parsed),
    medicalNecessitySignal: parsed.medical_necessity ?? undefined,
    patientName: parsed.patient_name ?? undefined,
    confidence: parsed.extraction_confidence,
    notes: parsed.notes ?? null,
  };
}

/**
 * Any failure here (API error, timeout, malformed/invalid JSON) is caught
 * and returned as `{ success: false }` rather than thrown — per Rules.md,
 * the caller (Phase 3's API route) must route these to MANUAL_REVIEW
 * instead of crashing or guessing.
 */
async function runExtraction(contents: unknown): Promise<ExtractionResult> {
  try {
    const ai = getClient();
    const response = await withTimeout(
      ai.models.generateContent({
        model: MODEL,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        contents: contents as any,
        config: {
          responseMimeType: "application/json",
          responseSchema: RESPONSE_SCHEMA,
          temperature: 0,
        },
      }),
    );

    const raw = response.text;
    if (!raw) {
      return { success: false, reason: "extraction_failed: empty response from model" };
    }

    const json = JSON.parse(raw);
    const parsed = ExtractionResponseSchema.safeParse(json);
    if (!parsed.success) {
      return { success: false, reason: `extraction_failed: schema validation failed (${parsed.error.message})` };
    }

    return toResult(parsed.data);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, reason: redactSecrets(`extraction_failed: ${message}`) };
  }
}

export async function extractFromText(documentText: string): Promise<ExtractionResult> {
  return runExtraction([{ role: "user", parts: [{ text: `${PROMPT}\n\nDocument text:\n${documentText}` }] }]);
}

export async function extractFromFile(
  fileBase64: string,
  mimeType: string,
): Promise<ExtractionResult> {
  return runExtraction([
    {
      role: "user",
      parts: [{ text: PROMPT }, { inlineData: { mimeType, data: fileBase64 } }],
    },
  ]);
}
