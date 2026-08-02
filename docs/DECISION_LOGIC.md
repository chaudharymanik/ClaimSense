# Decision Logic

This mirrors `adjudication_rules.md`'s own step structure and matches the
actual implementation in `lib/rules-engine/engine.ts` exactly — every node
below corresponds to a named step in that file's rule trail, so any claim's
detail page shows you exactly which path it took through this diagram.

```mermaid
flowchart TD
    Start([Claim submitted]) --> Process{Process checks:<br/>min amount, duplicate,<br/>late submission}
    Process -- fail --> R1[REJECTED<br/>BELOW_MIN_AMOUNT /<br/>DUPLICATE_CLAIM /<br/>LATE_SUBMISSION]
    Process -- pass --> Elig{Eligibility:<br/>policy active,<br/>waiting period,<br/>member covered}
    Elig -- fail --> R2[REJECTED<br/>POLICY_INACTIVE /<br/>WAITING_PERIOD /<br/>MEMBER_NOT_COVERED]
    Elig -- pass --> Docs{Document validation:<br/>present, legible,<br/>doctor reg format,<br/>dates/patient match}
    Docs -- fail --> R3[REJECTED<br/>MISSING_DOCUMENTS /<br/>ILLEGIBLE_DOCUMENTS /<br/>INVALID_PRESCRIPTION /<br/>DOCTOR_REG_INVALID /<br/>DATE_MISMATCH /<br/>PATIENT_MISMATCH]
    Docs -- pass --> Fraud{Fraud check:<br/>same-day multiple claims,<br/>high value >₹25k,<br/>blacklisted provider}
    Fraud -- flagged --> MR1[MANUAL_REVIEW<br/>fraud indicators]
    Fraud -- clear --> Necessity{Medical necessity:<br/>diagnosis present?}
    Necessity -- no --> R4[REJECTED<br/>NOT_MEDICALLY_NECESSARY]
    Necessity -- yes --> AISignal[/AI necessity signal recorded<br/>advisory only — confidence<br/>adjustment, never a reject/]
    AISignal --> Exclusion{Whole-claim exclusion:<br/>diagnosis matches a<br/>named policy exclusion?}
    Exclusion -- match --> R5[REJECTED<br/>SERVICE_NOT_COVERED /<br/>EXCLUDED_CONDITION /<br/>EXPERIMENTAL_TREATMENT /<br/>COSMETIC_PROCEDURE]
    Exclusion -- no match --> Itemize[Itemize bill:<br/>classify each line item,<br/>check pre-auth, cosmetic,<br/>vision/lasik exclusions]
    Itemize --> BillCheck{Billed items total ≤<br/>submitted claim amount<br/>+ rounding tolerance?}
    BillCheck -- no --> MR3[MANUAL_REVIEW<br/>billed total exceeds<br/>submitted claim amount]
    BillCheck -- yes --> AllExcluded{Every billed<br/>item excluded?}
    AllExcluded -- yes --> R6[REJECTED<br/>using the excluded item's code,<br/>e.g. PRE_AUTH_MISSING]
    AllExcluded -- no --> HasExcl{Any item<br/>excluded?}
    HasExcl -- no --> HardLimits{Per-claim limit,<br/>then annual limit,<br/>checked against gross amount}
    HardLimits -- exceeded --> R7[REJECTED<br/>PER_CLAIM_EXCEEDED /<br/>ANNUAL_LIMIT_EXCEEDED]
    HardLimits -- within --> SubLimits[Apply category sub-limits<br/>to covered items]
    HasExcl -- yes --> SubLimits
    SubLimits --> Deduct[Compute copay / network<br/>discount on approved total<br/>consultation category only]
    Deduct --> PartialCheck{Any exclusion or<br/>sub-limit cap applied?}
    PartialCheck -- yes --> Partial[Tentative: PARTIAL]
    PartialCheck -- no --> Approved[Tentative: APPROVED]
    Partial --> Confidence{Confidence score<br/>below 0.70?}
    Approved --> Confidence
    Confidence -- yes --> MR2[MANUAL_REVIEW<br/>low confidence]
    Confidence -- no --> Final([Final decision:<br/>APPROVED / PARTIAL<br/>as computed])

    style R1 fill:#ffdad6,color:#93000a
    style R2 fill:#ffdad6,color:#93000a
    style R3 fill:#ffdad6,color:#93000a
    style R4 fill:#ffdad6,color:#93000a
    style R5 fill:#ffdad6,color:#93000a
    style R6 fill:#ffdad6,color:#93000a
    style R7 fill:#ffdad6,color:#93000a
    style MR1 fill:#e4bdbc,color:#3a1f1f
    style MR2 fill:#e4bdbc,color:#3a1f1f
    style MR3 fill:#e4bdbc,color:#3a1f1f
    style Approved fill:#e6f4ea,color:#137333
    style Final fill:#e6f4ea,color:#137333
```

## Priority rules (from `adjudication_rules.md`, and how the engine honors them)

1. **Safety first** — fraud detection runs before coverage/limit logic and
   routes straight to `MANUAL_REVIEW`, bypassing everything downstream.
2. **Exclusions override everything** — the whole-claim exclusion check runs
   before limit checks, which is why a claim that's both excluded *and* over
   the per-claim limit (e.g. an excluded ₹8,000 weight-loss claim) is
   rejected for the exclusion, not the limit.
3. **Hard limits cannot be exceeded** — but only apply to the *gross* amount
   when nothing was excluded (see `docs/ASSUMPTIONS.md` #3 for why: two of
   the ten provided test cases exceed the per-claim limit yet are correctly
   partial/rejected for their own item-level reason instead).
4. **Medical necessity is mandatory** — the deterministic check (diagnosis
   must be present) is a hard gate; the LLM's necessity opinion is not — it
   only nudges confidence.
5. **When in doubt, refer for manual review** — the confidence-below-0.70
   gate is the final step of every path, so even a claim that clears every
   other check can still end up in `MANUAL_REVIEW` if the system isn't sure.
6. **Extracted bill amounts are never trusted over what the claimant
   submitted** — added during a security review after a live
   prompt-injection test got the LLM to report a bill amount higher than
   the submitted `claim_amount`, which the engine then paid out.
   The billed-total-vs-claim-amount check runs right after itemization,
   before any money is computed, and is itself fully deterministic — it
   doesn't try to make extraction trustworthy, it just refuses to let a
   mismatched number drive a payout.

## Scope note: what this diagram does and doesn't cover

Every limit, sub-limit, waiting period, exclusion, and copay/discount rate
this flowchart references is read from whatever policy is currently active
in `PolicyConfig` (admin-editable at `/admin/policy`), not necessarily the
static `data/policy_terms.json` on disk — the two start out identical, but
diverge the moment an admin saves an edit. The diagram's shape (which
checks run, in what order) never changes; only the threshold *values* each
node compares against can.

The **appeals workflow** is deliberately not represented as a node here. It
is a separate, post-decision process: a human administrator reviewing a
`REJECTED`/`PARTIAL` claim and choosing to uphold or overturn it. An
overturned appeal changes `Claim.status` but never re-runs or rewrites the
engine's own decision above — the diagram describes how the *original*
automated decision was reached, and that reasoning trail stays intact and
visible regardless of what an appeal later does to the claim's outward
status. See `docs/ASSUMPTIONS.md` #19-22 for the appeal-specific rules.
