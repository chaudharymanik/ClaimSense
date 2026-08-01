# Architecture

## System diagram

```mermaid
flowchart LR
    User([Claims analyst / member]) -->|submits claim| UI[Next.js UI<br/>App Router pages]
    UI -->|POST /api/claims| API[API routes<br/>app/api/claims]
    API --> Save1[(Save Claim row<br/>status: PROCESSING)]
    API --> Extract{document_file?}
    Extract -- image/PDF --> Vision[Gemini vision/document input<br/>lib/llm/extraction.ts]
    Extract -- pasted text --> Text[Gemini text input<br/>lib/llm/extraction.ts]
    Vision --> Validate[Zod schema validation<br/>lib/llm/schemas.ts]
    Text --> Validate
    Validate -- fails --> Fallback[MANUAL_REVIEW<br/>with failure reason]
    Validate -- passes --> Engine[Deterministic rules engine<br/>lib/rules-engine/engine.ts<br/>pure TypeScript, no I/O]
    Engine --> Save2[(Save ExtractedData +<br/>Decision rows)]
    Fallback --> Save2
    Save2 --> Response[Decision JSON returned]
    Response --> UI
    UI -->|GET /api/claims, /:id| API
    API -->|Prisma| DB[(Supabase Postgres)]

    Detail[Claim detail page] -->|POST /:id/ask| Ask[lib/llm/explainDecision.ts]
    Ask -->|reads stored decision only| DB
    Ask -->|Gemini, explanation-only| Detail
```

## Tech stack and why

| Layer | Choice | Why |
|---|---|---|
| Frontend + Backend | Next.js (App Router), TypeScript strict | One framework for both, shippable solo in a short window |
| Styling | Tailwind CSS v3, ported design tokens | Pixel-matches the `Design/` mockups; v3's JS config could be copied from the mockups verbatim (v4's CSS-first config would need manual re-translation) |
| Database | Supabase (Postgres) | Free tier, hosted, no infra to manage |
| ORM | Prisma v6 | Type-safe schema/migrations |
| LLM | Google Gemini (`@google/genai`) | Genuinely free tier (no card), multimodal (image/PDF), and — critically — a *cloud* API reachable from a deployed backend, unlike a local model. See `docs/ASSUMPTIONS.md` #2 for why this isn't the originally-planned commercial LLM API. |
| Validation | Zod | Every LLM response and every API request body is schema-validated before touching the rules engine or the database |

## The one architectural rule everything else follows

**The rules engine (`lib/rules-engine/`) is a pure function with zero I/O** —
no database calls, no network calls, no LLM calls. It takes a `ClaimInput`
and a `MedicalNecessitySignal | undefined` and returns a `Decision`,
deterministically, every time. This is what makes it possible to unit-test
all 10 required scenarios (plus 19 supplementary ones covering codes/
categories/scenarios the 10 don't reach) in milliseconds with `npm test`,
with no API keys or database needed.

The LLM (`lib/llm/`) only ever produces two things, and neither is the
decision itself:
1. **Extracted facts** (`ExtractionResult.documents`) — fed into the engine
   as input, same shape whether it came from pasted text or a photographed
   document.
2. **Advisory signals** — the medical-necessity opinion (adjusts confidence,
   never rejects — see `docs/ASSUMPTIONS.md` #14 for a real bug this
   distinction fixed) and the "Ask about this decision" explanations (read
   the already-final decision, never write to it).

## Folder structure

```
/app
  /api/claims            → POST (submit), GET (list)
  /api/claims/[id]        → GET (detail)
  /api/claims/[id]/ask     → POST (AI explanation, bonus feature)
  /claims                → dashboard (stats, decision breakdown, recent claims)
  /claims/new              → submission form (text paste + file upload)
  /claims/[id]               → claim detail (data, confidence, rule trail, Q&A)
  /claims/review               → manual review queue (bonus feature)

/lib
  /rules-engine           → pure, deterministic. One file per adjudication_rules.md
                             step: eligibility, documents, coverage, limits,
                             medicalNecessity, fraud, process, confidence, engine
  /llm                     → Gemini extraction (text + vision), explanation Q&A,
                              Zod schemas, shared client
  /api                     → request validation + orchestration (processClaim.ts)
  /db                      → Prisma client singleton
  types.ts                 → shared types (ClaimInput, Decision, RejectionCode, ...)

/prisma
  schema.prisma            → Claim, ExtractedData, Decision tables + migrations

/data                      → policy_terms.json, adjudication_rules.md — loaded at
                              runtime, not hardcoded into engine logic

/tests
  rules-engine.test.ts      → all 10 required cases + 19 supplementary
  llm-extraction.test.ts     → mocked extraction error-handling paths
  fixtures/test_cases.json    → the provided fixture, unmodified

/components                 → shared UI (TopNav, StatusPill, DecisionBreakdown,
                               AskAboutDecision)

/Design                      → source-of-truth mockups (see docs/ASSUMPTIONS.md
                                and Memory.md for how inconsistencies between them
                                were reconciled)
```

## Deployment plan (not yet deployed — see README)

1. Push to GitHub.
2. Connect the repo to Vercel; set `DATABASE_URL`, `DIRECT_URL`,
   `GEMINI_API_KEY` as environment variables.
3. `npx prisma migrate deploy` against the Supabase database (already
   provisioned and migrated for local development).
4. Re-run the 10 required test cases against the deployed URL before
   considering the submission final.
