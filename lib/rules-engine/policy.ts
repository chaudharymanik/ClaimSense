import policyJson from "@/data/policy_terms.json";

// Loaded at runtime from /data, not hardcoded into engine logic, per Architecture.md.
export const POLICY = policyJson;
export type PolicyTerms = typeof policyJson;
