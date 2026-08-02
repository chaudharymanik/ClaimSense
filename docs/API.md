# API Documentation

All routes are Next.js App Router route handlers under `/app/api`. All
responses are JSON. Every route below except `POST /api/auth/login` requires
a valid demo-login session (`proxy.ts`); routes under `/api/admin/*` require
a *second*, separate admin session on top of that (see README's Known
Limitations for what these two credentials do and don't protect against).

## `POST /api/auth/login`

Public — the only route reachable without a session. Checks the submitted
password against the day's rotating demo password (`todaysDemoPassword()`,
shown openly on `/login`). On success, sets the regular session cookie.

**Request:** `{ "password": "..." }` · **Response — `200`:** `{ "success": true }` ·
**Errors:** `401` incorrect password.

## `POST /api/auth/logout`

Clears both the regular session cookie **and** the admin session cookie, not
just the former — the admin session is layered on top of the regular one
(`proxy.ts`), so leaving it alive after the base session ends would be a
stale, functionally meaningless credential. Idempotent: safe to call with no
session at all.

**Response — `200`:** `{ "success": true }`

## `POST /api/admin/logout`

Drops only the admin credential, back to the regular demo session — not a
full logout. Reachable with just the regular session (does not itself
require a currently-valid admin session), so it always succeeds even if the
admin session already expired.

**Response — `200`:** `{ "success": true }`

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
treatment date (see `docs/ASSUMPTIONS.md` #17).

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
Full detail is only ever returned per-record, by `GET /api/claims/:id`.

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

Full detail for one claim: the claim row, its extracted fields, its
decision (including the full rule trail), and its appeal, if one exists.

- `200` — `{ "claim": { ..., "extractedData": {...} | null, "decision": {...} | null, "appeal": {...} | null } }`
- `404` — `{ "error": "Claim not found" }`

## `POST /api/claims/:id/ask`

Bonus feature: ask a natural-language question about one claim's already-
finalized decision. Grounded entirely in that claim's stored decision/trail;
cannot alter the decision — it never writes to the database at all.

**Request:** `{ "question": "Why wasn't the full amount approved?" }` (max 500 chars)

**Response — `200`:** `{ "answer": "..." }`

**Errors:** `400` invalid request, `404` claim/decision not found, `502` the
LLM call itself failed (rare — same failure modes as extraction).

## `POST /api/claims/:id/appeal`

Bonus feature: appeal a `REJECTED` or `PARTIAL` claim's decision. One appeal
per claim — a second attempt on the same claim is rejected. The original
`Decision` row is never touched by an appeal at any stage; it stays the
permanent record of what the deterministic engine actually decided.

**Request:** `{ "reason": "..." }` (1–1000 chars)

**Response — `201`:** `{ "appeal": { "id": "...", "status": "PENDING", "reason": "...", "createdAt": "..." } }`

**Errors:** `400` invalid request or claim isn't in an appealable status,
`404` claim not found, `409` an appeal already exists for this claim.

## `POST /api/admin/login`

Admin-only. Checks the submitted password against `ADMIN_PASSWORD` (a
separate, static secret — never rotates, never displayed anywhere, distinct
from the demo login password). On success, sets a second, independent
session cookie required by every `/admin/*` and `/api/admin/*` route on top
of (not instead of) the regular demo session.

**Request:** `{ "password": "..." }`

**Response — `200`:** `{ "success": true }` · **Errors:** `401` incorrect password.

## `GET /api/admin/appeals`

Admin-only. Lists appeals (most recent first, capped at 50) with enough
claim context to triage — member name, claim amount, the original decision
summary — not the full claim record.

**Response — `200`:** `{ "appeals": [ { "id": "...", "reason": "...", "status": "PENDING", "claim": { "id": "...", "memberName": "...", "claimAmount": 1500, "status": "REJECTED", "decision": {...} } } ] }`

## `POST /api/admin/appeals/:id/resolve`

Admin-only. Resolves a pending appeal as `UPHELD` (original decision stands)
or `OVERTURNED` (claim's effective status becomes `APPROVED`). The original
`Decision` row is left exactly as the engine produced it — the override is
layered on top, in the `Appeal` row, not written over history.

**Request:**
```jsonc
{
  "status": "OVERTURNED",             // "UPHELD" | "OVERTURNED"
  "resolutionNote": "...",            // required, 1-1000 chars
  "overrideAmount": 1800              // required only if status is "OVERTURNED"
}
```

`overrideAmount` can never exceed the claim's originally submitted
`claim_amount` — the same "never pay more than what was actually claimed"
invariant the rules engine itself enforces against prompt-injected bill
amounts (see `docs/DECISION_LOGIC.md`'s priority rules, #6) applies here
too, just enforced by the admin route instead of the engine.

**Errors:** `400` invalid request, missing/oversized `overrideAmount`, or
`overrideAmount` exceeds the claim amount · `404` appeal not found · `409`
appeal was already resolved.

## `GET /api/admin/policy`

Admin-only. Returns the current policy configuration — the same data the
rules engine reads for every claim (`lib/db/policyConfig.ts`), falling back
to the static `policy_terms.json`-derived default if the database row
doesn't exist yet.

**Response — `200`:** `{ "policy": { ...full policy shape... } }`

## `PUT /api/admin/policy`

Admin-only. Replaces the policy configuration wholesale — the request body
must be the complete policy shape (validated field-by-field via Zod), not a
partial patch. Takes effect for every claim submitted after saving; existing
claims and decisions are never retroactively recomputed.

**Errors:** `400` malformed JSON or a validation failure, with Zod's
`flatten()` output identifying exactly which field(s) are wrong.
