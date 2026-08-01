# ClaimSense — OPD Claim Adjudication Tool

An AI-assisted tool that automates approve/reject/partial decisions for
Outpatient Department (OPD) insurance claims: it extracts structured data
from a prescription/bill (pasted text or an uploaded photo/PDF), runs it
through a deterministic rules engine derived from the policy, and returns a
decision with a confidence score and a full rule-by-rule reasoning trail.

Built for Plum's AI Automation Engineer intern assignment.

## What it does

1. **Accepts a claim** — member details, treatment date, claim amount, and
   the supporting document as either pasted text or an uploaded image/PDF.
2. **Extracts structured fields** — doctor registration, diagnosis,
   medicines, billed line items — using Google Gemini (reads images/PDFs
   natively, no separate OCR step).
3. **Adjudicates deterministically** — a pure TypeScript rules engine
   (zero I/O, fully unit-tested) checks eligibility, document validity,
   coverage/exclusions, limits, medical necessity, and fraud indicators, in
   the priority order `adjudication_rules.md` specifies. The LLM never makes
   this call — it only supplies extracted facts and an advisory signal.
4. **Explains itself** — every decision includes a confidence score, exact
   rejection codes, and a full trail of which checks passed/failed and why.
   You can also ask a follow-up question about any decision and get an
   AI-generated explanation grounded in that claim's actual data.

## Documentation

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — system diagram, tech
  stack rationale, folder structure
- [`docs/API.md`](docs/API.md) — full API reference
- [`docs/DECISION_LOGIC.md`](docs/DECISION_LOGIC.md) — the adjudication
  flowchart, matching the actual engine code path-for-path
- [`docs/ASSUMPTIONS.md`](docs/ASSUMPTIONS.md) — every assumption made,
  and why (inferred rules, scope decisions, data we don't have)
- [`docs/USER_GUIDE.md`](docs/USER_GUIDE.md) — every required test case
  (plus a few extra rule checks) with its expected result and a real
  screenshot of the app producing it — the fast way to confirm the tool
  works without submitting claims yourself

## Setup

### Prerequisites

- Node.js 20+ and npm
- A [Google AI Studio](https://aistudio.google.com/apikey) API key (free,
  no card required)
- A [Supabase](https://supabase.com) project (free tier, no card required)
  — for its Postgres database

### Install

```bash
npm install
```

### Configure environment

Copy `.env.example` to `.env` and fill in:

```bash
cp .env.example .env
```

- `DATABASE_URL` / `DIRECT_URL` — from your Supabase project's **Connect**
  dialog → ORMs → Prisma. **URL-encode special characters in the password**
  (`@` → `%40`, `#` → `%23`, etc.) or the connection string will silently
  truncate.
- `GEMINI_API_KEY` — from [aistudio.google.com/apikey](https://aistudio.google.com/apikey).
- `AUTH_SEED` — any random string, generate one with
  `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
  Powers the demo login gate (see "Known limitations" below) — not itself a
  password, just the seed the daily password is derived from.

### Set up the database

```bash
npx prisma migrate dev
```

### Run it

```bash
npm run dev
```

Visit `http://localhost:3000` (redirects to `/claims`).

### Run the tests

```bash
npm test        # rules engine (all 10 required cases + supplementary coverage) + extraction/redaction handling
npm run build    # type-check + production build
npm run lint     # ESLint
```

43 tests, all passing, no external calls required (the rules-engine tests
use pre-extracted fixture data directly, bypassing the LLM entirely, per
the assignment's own test case format).

## Tech stack

Next.js (App Router) · TypeScript (strict) · Tailwind CSS · Prisma ·
Supabase (Postgres) · Google Gemini · Zod · Vitest

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the full rationale
behind each choice, including why the LLM provider differs from the
originally-planned one.

## Deployment

Not yet deployed. Planned: Vercel (frontend/API) + the existing Supabase
database. See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md#deployment-plan-not-yet-deployed--see-readme)
for the exact steps.

## Known limitations

See [`docs/ASSUMPTIONS.md`](docs/ASSUMPTIONS.md) for the full list. The
notable ones:

- **Shared demo password, not real per-user authentication.** The deployed
  site sits behind a single login gate (`proxy.ts` + `/login`) — no request
  reaches any page or API route without it. The password isn't a static
  secret: it's derived from a server-side seed (`AUTH_SEED`, never itself
  displayed) plus the current UTC date, so it rotates automatically at
  midnight with no code running and no database involved, and is shown
  openly on the login page itself so an evaluator can self-serve without
  needing it emailed to them. This is deliberately a demo-URL speed bump,
  not access control — once past it, every claim (names, diagnoses,
  amounts) is visible to whoever's behind the gate, the same as before.
  Concretely, tested live (before the gate existed): `GET /api/claims`
  handed out every real claim ID directly, and `GET /api/claims/:id`
  returned full PII for any of them — no guessing required. **For an actual
  company deployment**, this would be replaced with real per-user/per-organization
  authentication — [Clerk's Organizations](https://clerk.com/docs/organizations/overview)
  specifically, so each claims adjuster has their own identity, and access
  and actions are scoped and audited per person rather than shared behind
  one credential.
- **LLM extraction signals (`extraction_confidence`,
  `medical_necessity.necessary`) are self-reported by the model and are
  themselves promptable** — a crafted document could attempt to suppress
  the illegibility/manual-review gates that key off them. This can no
  longer affect *how much gets approved* (a deterministic check in the
  rules engine caps the payout at the submitted claim amount regardless of
  what the LLM reports), only *which claims get routed to a human*. Fully
  closing this would need a second,
  extraction-independent document-quality signal — out of scope for this
  timeline.
- **No rate limiting or CORS restrictions.** Same root cause as the point
  above — there's no signup/login flow in this version, so there's no
  per-user identity to rate-limit against, and no browser-based third-party
  client that would need a CORS policy. A production version handling real
  traffic would need both: rate limiting on `POST /api/claims` in particular
  (it triggers a paid-tier-adjacent Gemini call per submission) and an
  explicit CORS policy once there's a real frontend origin to restrict to.
- **No data retention or deletion policy.** This is a demo/assignment app
  with no real member data, so it's out of scope here — but the claim
  records it stores are health-adjacent (diagnoses, treatment details,
  member names) by nature of what an OPD claim is. A production version
  would need an explicit retention window, a deletion/right-to-erasure path
  for a member's data, and encryption-at-rest policy for the database,
  before it could hold real claimant data.
- No real employee/member database exists — `data/member_roster.json`
  simulates one (covers every ID used in this project's test scenarios),
  so `MEMBER_NOT_COVERED` is genuinely enforced, just against seeded data
  rather than a real HR system.
- Search and pagination shown in the original design mockups aren't wired
  up — not needed at demo scale, but a real gap if judged purely on
  matching the mockups pixel-for-pixel.
- Fraud detection is a small heuristic set (same-day multiple claims,
  high-value threshold, blacklisted provider, exact-match duplicate
  detection), not a trained model.
- `LATE_SUBMISSION` and `DATE_MISMATCH` are implemented and unit-tested but
  not wired to real submission timestamps/per-document dates — see
  `docs/ASSUMPTIONS.md` #16-17 for why (short version: this project's test
  data is intentionally dated 2024 to match `test_cases.json`, so
  auto-computing against the real current date would break every test case
  in the project).
