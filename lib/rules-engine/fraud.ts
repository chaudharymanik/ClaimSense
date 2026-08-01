import type { ClaimInput } from "@/lib/types";

export interface FraudResult {
  flagged: boolean;
  flags: string[];
}

const HIGH_VALUE_THRESHOLD = 25000;

/**
 * adjudication_rules.md's "Fraud Indicators" list is broader than what
 * test_cases.json exercises (only "multiple claims same provider same day",
 * via TC008). The other indicators are wired to optional ClaimInput fields
 * so they're implemented and unit-testable, not just documented.
 */
export function checkFraud(claim: ClaimInput): FraudResult {
  const flags: string[] = [];

  if ((claim.previous_claims_same_day ?? 0) >= 2) {
    flags.push("Multiple claims same day", "Unusual pattern detected");
  }

  if (claim.claim_amount > HIGH_VALUE_THRESHOLD) {
    flags.push("High-value claim (>₹25,000)");
  }

  if (claim.provider_blacklisted) {
    flags.push("Provider not registered/blacklisted");
  }

  return { flagged: flags.length > 0, flags };
}
