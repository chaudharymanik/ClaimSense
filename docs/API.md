# API Documentation

All routes are Next.js App Router route handlers under `/app/api`. All
responses are JSON. There is no authentication (see `docs/ASSUMPTIONS.md`).

## `POST /api/claims`

Submits a new claim. Runs the full pipeline synchronously: saves the claim,
extracts structured fields from the document (text or uploaded image/PDF via
Gemini), runs the deterministic rules engine, saves the decision, and
returns it — all in one request/response cycle.

### Request body

```jsonc
{
  "member_id": "EMP001",             // required
  "member_name": "Rajesh Kumar",     // required
  "member_join_date": "2024-09-01",  // optional, ISO date
  "treatment_date": "2024-11-01",    // required, ISO date
  "claim_amount": 1500,              // required, positive integer (rupees)
  "hospital": "Apollo Hospitals",    // optional
  "cashless_request": false,         // optional, boolean

  // Exactly one of these two is required:
  "document_text": "Dr. Sharma, Reg. No: KA/45678/2015...",
  "document_file_base64": "<base64-encoded image/PDF bytes>",
  "document_file_mime": "image/png"  // required if document_file_base64 is set
}
```

`previous_claims_same_day` is intentionally **not** a request field — it's
computed server-side from actual claim history for the same member and
treatment date (see `docs/ASSUMPTIONS.md` #13).

### Response — `201 Created`

```jsonc
{
  "claimId": "cms91pamc0000maxgeqfh4cgj",
  "decision": {
    "claim_id": "cms91pamc0000maxgeqfh4cgj",
    "decision": "APPROVED",          // APPROVED | REJECTED | PARTIAL | MANUAL_REVIEW
    "approved_amount": 1350,         // null for REJECTED/MANUAL_REVIEW
    "deductions": { "copay": 150 },  // present only when a copay applied
    "rejection_reasons": [],         // array of exact codes from adjudication_rules.md
    "rejected_items": [],            // human-readable, only for PARTIAL
    "flags": [],                     // fraud/manual-review flags
    "cashless_approved": true,       // only for network+cashless claims
    "network_discount": 900,         // only for network claims
    "confidence_score": 0.95,
    "notes": "Claim approved in full.",
    "next_steps": "Approved amount will be disbursed.",
    "trail": [
      { "step": "Process Validation", "passed": true, "message": "..." },
      { "step": "Eligibility", "passed": true, "message": "..." }
      // ... one entry per rule stage, see docs/DECISION_LOGIC.md
    ]
  }
}
```

### Error responses

| Status | Body | When |
|---|---|---|
| 400 | `{ "error": "Request body must be valid JSON" }` | Malformed JSON |
| 400 | `{ "error": "Invalid claim submission", "details": {...} }` | Zod validation failure (missing/invalid fields) — `details` is Zod's `flatten()` output |
| 500 | `{ "error": "Failed to process claim", "message": "..." }` | Unexpected server error |

Extraction failures (bad LLM response, timeout, schema mismatch) do **not**
error the request — they still return `201` with `decision.decision ==
"MANUAL_REVIEW"` and the failure reason in `notes`, per the "never crash,
route to manual review" rule.

## `GET /api/claims`

Lists claims, most recent first (capped at 25). Returns a slim summary only —
no `documentText` (the raw pasted/extracted document, which can contain
diagnosis text) and no decision `notes`/`ruleTrail`/`rejectedItems`/`flags`.
Full detail is only ever returned per-record, by `GET /api/claims/:id`. See
`docs/DATA_FLOW_AUDIT.md`.

```jsonc
{
  "claims": [
    {
      "id": "cms91pamc0000maxgeqfh4cgj",
      "memberId": "EMP001",
      "memberName": "Rajesh Kumar",
      "treatmentDate": "2024-11-01T00:00:00.000Z",
      "claimAmount": 1500,
      "status": "APPROVED",
      "createdAt": "2026-08-01T09:12:00.000Z",
      "decision": { "decision": "APPROVED", "approvedAmount": 1350, "confidenceScore": 0.95 }
    }
  ]
}
```

## `GET /api/claims/:id`

Full detail for one claim: the claim row, its extracted fields, and its
decision (including the full rule trail).

- `200` — `{ "claim": { ..., "extractedData": {...} | null, "decision": {...} | null } }`
- `404` — `{ "error": "Claim not found" }`

## `POST /api/claims/:id/ask`

Bonus feature: ask a natural-language question about one claim's already-
finalized decision. Grounded entirely in that claim's stored decision/trail;
cannot alter the decision (see `docs/ASSUMPTIONS.md` #14 and `Rules.md` — the
LLM never decides, and this endpoint doesn't write to the database at all).

**Request:** `{ "question": "Why wasn't the full amount approved?" }` (max 500 chars)

**Response — `200`:** `{ "answer": "..." }`

**Errors:** `400` invalid request, `404` claim/decision not found, `502` the
LLM call itself failed (rare — same failure modes as extraction).
