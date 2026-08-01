import type { BillDoc, Category, ClaimInput, LineItemResult, RejectionCode } from "@/lib/types";
import type { PolicyTerms } from "./policy";

function prettifyKey(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Classifies a single bill line item by its key name into a coverage category. */
export function classifyItem(key: string): Category {
  const k = key.toLowerCase();
  if (/root_?canal|extraction|filling|cleaning|dental|tooth|teeth/.test(k)) return "dental";
  if (/lasik|glasses|contact_?lens|eye_?test|vision/.test(k)) return "vision";
  if (/therapy_?charges|ayurved|homeopath|unani|panchakarma/.test(k)) return "alternative_medicine";
  if (/medicine|pharmacy|drug/.test(k)) return "pharmacy";
  if (/mri|ct_?scan|x_?ray|ultrasound|ecg|blood|urine|diagnostic|lab|test/.test(k)) return "diagnostics";
  if (/consult/.test(k)) return "consultation";
  if (/diet_?plan|weight_?loss|bariatric/.test(k)) return "excluded";
  return "other";
}

/** Whole-claim primary category, from doctor registration + diagnosis/treatment context. */
export function determinePrimaryCategory(claim: ClaimInput, items: LineItemResult[]): Category {
  const prescription = claim.documents.prescription;
  const docReg = prescription?.doctor_reg ?? "";
  const text = [
    prescription?.diagnosis ?? "",
    prescription?.treatment ?? "",
    (prescription?.procedures ?? []).join(" "),
  ]
    .join(" ")
    .toLowerCase();

  if (/^ayur/i.test(docReg) || /ayurved|homeopath|unani|panchakarma/.test(text)) {
    return "alternative_medicine";
  }
  if (/root canal|extraction|filling|cleaning|tooth|teeth|dental/.test(text)) {
    return "dental";
  }
  if (/\blasik\b|\bvision\b|\beye\b/.test(text)) {
    return "vision";
  }
  if (/weight loss|obesity|bariatric|\bbmi\b/.test(text)) {
    return "excluded";
  }
  if (/infertility/.test(text)) {
    return "excluded";
  }

  const hasConsultationItem = items.some((i) => i.category === "consultation");
  const hasDiagnosticsItem = items.some((i) => i.category === "diagnostics");
  if (!hasConsultationItem && hasDiagnosticsItem) {
    return "diagnostics";
  }
  if (hasConsultationItem) {
    return "consultation";
  }

  // No consultation/diagnostics item and no diagnosis-keyword match (e.g. a
  // pure pharmacy refill, or a dental/vision claim whose diagnosis text
  // doesn't happen to use one of the matched keywords above) — fall back to
  // whichever category the actual billed amount is concentrated in, rather
  // than blindly defaulting to "consultation". The old unconditional
  // "return consultation" here caused pharmacy-only claims to incorrectly
  // get a consultation co-pay applied (found via user testing, ₹2,500 →
  // ₹2,250 when it should stay ₹2,500 — see Memory.md/TEST_SCENARIOS.md).
  if (items.length > 0) {
    const totals = new Map<Category, number>();
    for (const item of items) {
      totals.set(item.category, (totals.get(item.category) ?? 0) + item.amount);
    }
    const [topCategory] = [...totals.entries()].sort((a, b) => b[1] - a[1])[0] ?? [];
    if (topCategory) return topCategory;
  }

  return "consultation";
}

/** Named-exclusion diagnosis keywords -> the most specific applicable rejection code. */
const EXCLUSION_KEYWORD_CODES: Array<{ pattern: RegExp; code: RejectionCode; label: string }> = [
  { pattern: /weight loss|obesity|bariatric|\bbmi\b/i, code: "SERVICE_NOT_COVERED", label: "Weight loss treatment" },
  { pattern: /infertility/i, code: "SERVICE_NOT_COVERED", label: "Infertility treatment" },
  { pattern: /experimental/i, code: "EXPERIMENTAL_TREATMENT", label: "Experimental treatment" },
  { pattern: /cosmetic/i, code: "COSMETIC_PROCEDURE", label: "Cosmetic procedure" },
  { pattern: /self.?inflicted/i, code: "EXCLUDED_CONDITION", label: "Self-inflicted injury" },
  { pattern: /adventure sport/i, code: "EXCLUDED_CONDITION", label: "Adventure sports injury" },
  { pattern: /hiv|aids/i, code: "EXCLUDED_CONDITION", label: "HIV/AIDS treatment" },
  { pattern: /alcoholis|drug abuse/i, code: "EXCLUDED_CONDITION", label: "Alcoholism/drug abuse treatment" },
];

export interface WholeClaimExclusion {
  code: RejectionCode;
  message: string;
}

/** If the diagnosis/treatment itself matches a named policy exclusion, the whole claim is rejected. */
export function checkWholeClaimExclusion(claim: ClaimInput): WholeClaimExclusion | undefined {
  const prescription = claim.documents.prescription;
  const text = [prescription?.diagnosis ?? "", prescription?.treatment ?? ""].join(" ");
  for (const { pattern, code, label } of EXCLUSION_KEYWORD_CODES) {
    if (pattern.test(text)) {
      return { code, message: `${label} is excluded from coverage.` };
    }
  }
  return undefined;
}

function amountEntries(bill: BillDoc): Array<[string, number]> {
  return Object.entries(bill).filter(
    (entry): entry is [string, number] => typeof entry[1] === "number",
  );
}

const PRE_AUTH_REQUIRED_PATTERN = /mri|ct_?scan/i;

/** Per-line-item coverage: covered categories, exclusions, and diagnostics pre-auth. */
export function itemizeBill(claim: ClaimInput, policy: PolicyTerms): LineItemResult[] {
  const bill = claim.documents.bill ?? {};
  const results: LineItemResult[] = [];

  for (const [key, amount] of amountEntries(bill)) {
    const category = classifyItem(key);
    const label = prettifyKey(key);

    if (category === "dental" && /whiten/.test(key.toLowerCase())) {
      results.push({
        key,
        label,
        amount,
        category,
        covered: false,
        reasonCode: "COSMETIC_PROCEDURE",
        reasonMessage: `${label} - cosmetic procedure`,
      });
      continue;
    }

    if (category === "vision" && /lasik/.test(key.toLowerCase()) && !policy.coverage_details.vision.lasik_surgery) {
      results.push({
        key,
        label,
        amount,
        category,
        covered: false,
        reasonCode: "SERVICE_NOT_COVERED",
        reasonMessage: `${label} - LASIK surgery is not covered under this policy`,
      });
      continue;
    }

    if (category === "diagnostics" && PRE_AUTH_REQUIRED_PATTERN.test(key)) {
      results.push({
        key,
        label,
        amount,
        category,
        covered: false,
        reasonCode: "PRE_AUTH_MISSING",
        reasonMessage: `${label} requires pre-authorization, which was not obtained`,
      });
      continue;
    }

    if (category === "excluded") {
      results.push({
        key,
        label,
        amount,
        category,
        covered: false,
        reasonCode: "SERVICE_NOT_COVERED",
        reasonMessage: `${label} is not a covered service`,
      });
      continue;
    }

    results.push({ key, label, amount, category, covered: true });
  }

  return results;
}
