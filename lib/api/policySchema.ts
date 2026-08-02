import { z } from "zod";

/**
 * Full validation for an admin-submitted policy update — every field the
 * rules engine actually reads, so a malformed or partial submission can
 * never leave the database holding a policy shape the engine doesn't
 * understand. Mirrors data/policy_terms.json's structure exactly.
 */
export const PolicyTermsSchema = z.object({
  policy_id: z.string().min(1),
  policy_name: z.string().min(1),
  effective_date: z.string().min(1),
  policy_holder: z.object({
    company: z.string().min(1),
    employees_covered: z.number().int().positive(),
    dependents_covered: z.boolean(),
  }),
  coverage_details: z.object({
    annual_limit: z.number().int().positive(),
    per_claim_limit: z.number().int().positive(),
    family_floater_limit: z.number().int().positive(),
    consultation_fees: z.object({
      covered: z.boolean(),
      sub_limit: z.number().int().nonnegative(),
      copay_percentage: z.number().min(0).max(100),
      network_discount: z.number().min(0).max(100),
    }),
    diagnostic_tests: z.object({
      covered: z.boolean(),
      sub_limit: z.number().int().nonnegative(),
      pre_authorization_required: z.boolean(),
      covered_tests: z.array(z.string().min(1)),
    }),
    pharmacy: z.object({
      covered: z.boolean(),
      sub_limit: z.number().int().nonnegative(),
      generic_drugs_mandatory: z.boolean(),
      branded_drugs_copay: z.number().min(0).max(100),
    }),
    dental: z.object({
      covered: z.boolean(),
      sub_limit: z.number().int().nonnegative(),
      routine_checkup_limit: z.number().int().nonnegative(),
      procedures_covered: z.array(z.string().min(1)),
      cosmetic_procedures: z.boolean(),
    }),
    vision: z.object({
      covered: z.boolean(),
      sub_limit: z.number().int().nonnegative(),
      eye_test_covered: z.boolean(),
      glasses_contact_lenses: z.boolean(),
      lasik_surgery: z.boolean(),
    }),
    alternative_medicine: z.object({
      covered: z.boolean(),
      sub_limit: z.number().int().nonnegative(),
      covered_treatments: z.array(z.string().min(1)),
      therapy_sessions_limit: z.number().int().nonnegative(),
    }),
  }),
  waiting_periods: z.object({
    initial_waiting: z.number().int().nonnegative(),
    pre_existing_diseases: z.number().int().nonnegative(),
    maternity: z.number().int().nonnegative(),
    // Matches PolicyTerms's exact inferred shape (from the static JSON
    // import) rather than a general record — TypeScript infers named
    // object properties exactly, unlike arrays, so this has to line up
    // field-for-field with data/policy_terms.json for the engine's static
    // POLICY fallback type to stay compatible with admin-submitted data.
    specific_ailments: z.object({
      diabetes: z.number().int().nonnegative(),
      hypertension: z.number().int().nonnegative(),
      joint_replacement: z.number().int().nonnegative(),
    }),
  }),
  exclusions: z.array(z.string().min(1)),
  claim_requirements: z.object({
    documents_required: z.array(z.string().min(1)),
    submission_timeline_days: z.number().int().positive(),
    minimum_claim_amount: z.number().int().nonnegative(),
  }),
  network_hospitals: z.array(z.string().min(1)),
  cashless_facilities: z.object({
    available: z.boolean(),
    network_only: z.boolean(),
    pre_approval_required: z.boolean(),
    instant_approval_limit: z.number().int().nonnegative(),
  }),
});

export type PolicyTermsInput = z.infer<typeof PolicyTermsSchema>;
