# Assumptions

This document lists every assumption made while building ClaimSense, per the
assignment's own instruction to document assumptions rather than silently
skip scope or guess. Grouped by why the assumption was needed.

## Scope decisions (explicit trade-offs)

1. **Document processing uses Gemini's native vision/PDF input, not a
   separate OCR pipeline.** The assignment brief requires accepting
   images/PDFs; our original plan had scoped that out in favor of pasted
   text only. We added real upload support, but implemented it via the
   LLM's own multimodal input rather than a Tesseract/cloud-OCR step —
   avoids an extra dependency, and Gemini reads document images directly
   at least as well as a dedicated OCR+LLM pipeline would for this use case.
2. **LLM provider is Google Gemini, not a paid-tier-only commercial API.**
   The app must be a *deployed* service, and needed to run on a genuinely
   free tier (no card). The other commercial LLM APIs considered have no
   reliable free tier; a local model (Ollama) can't be reached by a
   deployed backend. Gemini's free tier is real, permanent, and
   multimodal, so it fits both constraints.
3. **Raw uploaded documents are not persisted to storage.** Images/PDFs are
   read once at submission time for extraction, then discarded — only the
   extracted structured fields and the pasted-text fallback (if used) are
   stored. No Supabase Storage bucket was set up for this MVP.
4. **No multi-policy support, no RAG/fine-tuning.** Single policy
   configuration (now admin-editable — see the "Bonus features" section
   below — but still exactly one active policy, not per-organization or
   versioned), direct policy-as-context to the LLM. These remain explicit
   out-of-scope calls, consistent with the assignment's own "prioritize
   core functionality" and "build an MVP, not a perfect solution" guidance.
   (Authentication and an admin dashboard *were* originally out of scope
   too, but were added later as bonus features once the deployed URL
   needed some form of access control — see below and README's Known
   Limitations for exactly what they do and don't protect against.)

## Inferred rules (not explicitly stated in adjudication_rules.md / policy_terms.json)

5. **Per-claim limit (₹5,000) only applies to a claim's gross amount when
   the claim has zero line-item exclusions.** Reverse-engineered from
   `test_cases.json`: TC002 (₹12,000, dental) and TC007 (₹15,000, MRI) both
   exceed ₹5,000 but are correctly PARTIAL/REJECTED for their *own*
   item-level reason (cosmetic exclusion / missing pre-auth), not
   `PER_CLAIM_EXCEEDED` — only TC003 (no exclusions at all) gets that code.
   So: no exclusions → the gross claim amount is checked against the
   per-claim limit as a hard cutoff; any exclusion → only category
   sub-limits govern the remaining (post-exclusion) approved portion.
6. **Copay and network discount are computed on the claim total, not
   per line item**, and only apply when the claim's primary category is
   "consultation." TC001's ₹150 copay is 10% of the ₹1,500 total, not 10%
   of the ₹1,000 consultation line alone. TC010's network discount
   similarly resolves to 20% of the ₹4,500 total. TC006 has a
   "consultation_fee" bill line but is approved with **no** copay because
   its real category is alternative medicine (the copay rate is only
   defined under `consultation_fees` in the policy) — so copay/discount
   are gated on the claim's overall category, not the presence of any one
   bill line item. (An earlier version of this logic had a bug where a
   claim with *no* consultation or diagnostics item at all — e.g. a pure
   pharmacy refill — fell through to a hardcoded "consultation" default and
   got a bogus copay anyway; fixed to fall back to whichever category the
   billed amount is actually concentrated in instead. See Memory.md.)
7. **MRI/CT scans always require pre-authorization**, regardless of claim
   amount. TC007's `notes` field mentions "requires pre-authorization for
   claims above ₹10,000," but no such threshold exists anywhere in
   `policy_terms.json` or `adjudication_rules.md` — the policy just marks
   MRI/CT as "(with pre-auth)" unconditionally. Treated the ₹10,000 figure
   as descriptive framing in that one test case's notes, not a real rule.
8. **Missing `member_join_date` defaults to the policy's `effective_date`
   (2024-01-01)** — i.e., assume enrolled since the policy began, so
   waiting periods are already satisfied. Only TC005 supplies a join date;
   the other 9 test cases resolve correctly under this default.
9. **Doctor registration numbers accept both the documented 3-segment
   format** (`KA/45678/2015`) **and a 4-segment alternative-medicine
   variant** (`AYUR/KL/2345/2019`, from TC006) — the format guide only
   describes the former, but the latter appears in the actual test data for
   an Ayurvedic practitioner and must not be rejected as invalid.
10. **`SERVICE_NOT_COVERED` vs. `EXCLUDED_CONDITION`**: treatments that
    aren't a recognized service category at all (weight loss, infertility)
    use `SERVICE_NOT_COVERED` (matches TC009's ground truth); named
    exclusion-list *conditions* that would otherwise fall under an
    otherwise-covered service type (self-inflicted injury, HIV/AIDS,
    substance abuse) use `EXCLUDED_CONDITION`. Cosmetic and experimental
    treatments get their own more specific codes.

## Data we don't have (no real backend system to check against)

11. **No real employee/member database exists — `data/member_roster.json`
    simulates one.** Plum's assignment package never provided actual HR
    data (only an aggregate `employees_covered: 500` count). Built a small
    seeded roster covering every member ID used across `test_cases.json`
    and the supplementary scenarios in `docs/USER_GUIDE.md` so
    `MEMBER_NOT_COVERED` is genuinely enforced end-to-end (an ID not on
    the list is really rejected) rather
    than only reachable via a test-only override flag. A real deployment
    would replace this file with an actual HR/roster integration — the
    check itself (`lib/rules-engine/roster.ts`) doesn't change.
12. **`PATIENT_MISMATCH` now runs on a real extracted field.** The LLM
    extraction prompt was extended to pull the patient name as written on
    the document (`patient_name`, separate from the coverage-relevant
    prescription fields) and compares it against the submitted
    `member_name`. Minor variations are tolerated (substring match either
    direction) per `adjudication_rules.md`'s own "minor variations
    acceptable" instruction.
13. **`ILLEGIBLE_DOCUMENTS` is now driven by the LLM's own extraction
    confidence**, not a manual flag: below a 0.4 confidence threshold, the
    document is treated as effectively unreadable regardless of which
    fields it did manage to extract. The 0.4 cutoff is a judgment call, not
    a value from any provided document — chosen because every real
    successful extraction seen during testing scored 0.87+, leaving a wide
    margin before this triggers on a genuinely legible document.
14. **`ANNUAL_LIMIT_EXCEEDED` is now computed from real approved-claim
    history**: the sum of this member's `APPROVED`/`PARTIAL` decisions'
    `approved_amount` within the same calendar year as the current
    treatment date (calendar year chosen as the "policy year" proxy, since
    the policy's `effective_date` is January 1st). Live-verified: 10
    approved ₹5,000 claims (₹50,000 total) all pass; an 11th correctly
    triggers the rejection.
15. **`DUPLICATE_CLAIM` is now computed from real claim history**: an exact
    match on member + treatment date + claim amount against an existing
    claim is treated as a duplicate submission. This is a deliberately
    narrow heuristic (adjudication_rules.md only says "same treatment
    already claimed," without defining what counts as "same") — a looser
    match (e.g. date + category, ignoring amount) risks false positives on
    two genuinely different treatments that happen to land on the same day.
16. **`LATE_SUBMISSION` is deliberately NOT wired to the real submission
    clock**, unlike the four checks above. It exists and is unit-tested via
    an explicit `submission_date` field, but is not auto-populated with the
    real current date. Reason: every test scenario in this project
    (required and supplementary) uses 2024 treatment dates to match
    `test_cases.json`'s fixtures, while the actual system clock is years
    later — auto-wiring "now" as the submission date would make every
    single test case in this project spuriously reject as late. A real
    deployment submitting claims for genuinely recent treatment would not
    have this problem; it's an artifact of testing against a fixed
    historical dataset, not a flaw in the check itself.
17. **`DATE_MISMATCH` remains untested via the UI.** It would need
    extracting a date from each individual document (bill date vs.
    prescription date) and cross-checking them — the extraction schema
    doesn't currently capture per-document dates, only the user-supplied
    `treatment_date`, which is already validated everywhere else in the
    pipeline. Lower priority than the five fixes above since the single
    `treatment_date` field is the one that actually drives every other
    rule; adding this would mean extending the extraction schema again for
    a check whose failure mode (a bill dated differently than a
    prescription) is comparatively rare and lower-stakes.
18. **Fraud detection remains a simplified heuristic set**, not a trained
    model: same-day multiple claims, a high-value threshold (>₹25,000), a
    blacklisted-provider flag, plus the duplicate-claim check above. The
    other indicators `adjudication_rules.md` lists (bill alterations,
    diagnosis/age mismatch) are implemented as reachable code paths but
    have no automatic real signal source yet.
19. **`previous_claims_same_day` and every other now-real signal above are
    computed server-side**, never user-submitted — a fraudulent or careless
    claimant wouldn't self-report any of these accurately.

## AI behavior

20. **The LLM's medical-necessity judgment is advisory only.** It can lower
    a decision's confidence score (which can route the claim to
    `MANUAL_REVIEW` if confidence drops below 0.70) but can never reject a
    claim by itself — only the deterministic rules engine can. An earlier
    build of this had a bug where the LLM signal *did* directly reject
    claims (see Memory.md); fixed and covered by manual verification.
21. **Confidence scores are derived from rule-check tiers** (how mechanical
    each check is — a presence/absence check is more certain than a
    keyword-based category classification), not reverse-engineered to
    match `test_cases.json`'s exact decimal values. The scoring rationale
    is documented in `lib/rules-engine/confidence.ts`.

## Bonus features (appeals, admin policy config, AI accuracy metrics)

22. **One appeal per claim, no multi-round appeal chains.** A claim that's
    already been appealed can't be appealed again, resolved or not. This
    keeps the workflow contained; a real production version might allow
    re-appealing after new evidence, but that's a meaningfully bigger
    feature (appeal history, versioned resolutions) than this scope calls
    for.
23. **Only `REJECTED` and `PARTIAL` claims are appealable.** `APPROVED` has
    nothing to contest; `MANUAL_REVIEW` is already pending human attention
    through the existing review queue, so a separate appeal on top of that
    would be redundant rather than meaningful.
24. **An appeal's `overrideAmount` can never exceed the claim's originally
    submitted `claim_amount`.** Deliberately the same invariant as the
    rules engine's own bill-vs-claim-amount reconciliation check
    (`docs/DECISION_LOGIC.md`'s priority rules, #6 — added after a live
    prompt-injection test) — an admin overturning a claim is still a
    human decision, not automated, but
    "never pay more than what was actually claimed" is a safety property
    worth enforcing everywhere money can be approved, not just in the one
    place it was originally found.
25. **Overturning an appeal changes `Claim.status` but never touches the
    original `Decision` row.** The rules engine's actual output stays a
    permanent, unedited audit record forever; the override is a separate
    layer on top, shown alongside it on the claim detail page. This was a
    deliberate design choice, not an oversight — rewriting history would
    undermine the "full rule-by-rule reasoning trail" transparency this
    project has maintained since the original build.
26. **Policy configuration is a single global row, not versioned or
    per-organization.** `PolicyConfig` is one singleton database row;
    editing it changes the policy for every claim submitted afterward,
    with no history of previous values and no way to schedule a future
    change. Existing claims and their decisions are never retroactively
    recomputed against a new policy — a policy edit is prospective only.
27. **The admin-editable policy falls back to the static
    `policy_terms.json`-derived default if the database row is ever
    missing** (a fresh database, or a deleted row) — the app never breaks
    claim processing because of this bonus feature; it just behaves as if
    no admin edit had ever been made.
28. **A second, separate admin credential (`ADMIN_PASSWORD`), not the same
    shared demo password.** Reusing the demo password (shown openly on
    `/login` for any evaluator) for policy configuration and appeal
    overrides would mean anyone with the link could silently change how
    every claim gets adjudicated. The admin credential is static (not
    rotating like the demo password), never displayed anywhere, and its
    session cookie deliberately expires sooner (8 hours vs. the demo
    session's 7 days) since it grants a more consequential capability. It
    is still one shared secret, not per-admin accounts — see README's Known
    Limitations.
29. **AI accuracy metrics use fixed confidence-bucket thresholds (≥0.90
    high, 0.70–0.89 good, 0.40–0.69 low, <0.40 illegible)**, not derived
    from any provided data. The 0.40 boundary specifically matches the
    existing `ILLEGIBLE_DOCUMENTS` cutoff (assumption #13 above) so the
    dashboard's "illegible" bucket means the same thing the engine already
    treats as illegible, rather than introducing a second, different
    definition of the word.
