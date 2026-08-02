# User Guide — Verified Test Cases

This is a visual walkthrough of ClaimSense handling every scenario in the
assignment's `test_cases.json`, plus a handful of additional rule checks,
each with its expected result and a real screenshot of the app producing
that exact result. If you don't want to submit claims yourself to confirm
the tool works, this page is the alternative — every screenshot below was
captured live against a running instance of the app, not mocked.

To try it yourself instead, go to the deployed URL, log in with the demo
credentials shown on the login page, and use **New Claim** to submit any
of the scenarios below (or your own test data) — see the main
[README](../README.md) for setup if running locally.

## Summary

| # | Scenario | Expected | Result |
|---|---|---|---|
| TC001 | Simple consultation | APPROVED, ₹1,350 | ✅ |
| TC002 | Dental — root canal + cosmetic add-on | PARTIAL, ₹8,000 | ✅ |
| TC003 | Per-claim limit exceeded | REJECTED — `PER_CLAIM_EXCEEDED` | ✅ |
| TC004 | Missing prescription | REJECTED — `MISSING_DOCUMENTS` | ✅ |
| TC005 | Diabetes within waiting period | REJECTED — `WAITING_PERIOD` | ✅ |
| TC006 | Ayurvedic treatment | APPROVED, ₹4,000 | ✅ |
| TC007 | MRI without pre-authorization | REJECTED — `PRE_AUTH_MISSING` | ✅ |
| TC008 | Multiple same-day claims (fraud) | MANUAL_REVIEW | ✅ |
| TC009 | Weight-loss treatment (excluded) | REJECTED — `SERVICE_NOT_COVERED` | ✅ |
| TC010 | Network hospital, cashless | APPROVED, ₹3,600, cashless | ✅ |
| EX01 | Same claim submitted twice | REJECTED — `DUPLICATE_CLAIM` | ✅ |
| EX02 | Malformed doctor registration number | REJECTED — `DOCTOR_REG_INVALID` | ✅ |
| EX03 | Member ID not on the roster | REJECTED — `MEMBER_NOT_COVERED` | ✅ |
| EX04 | Named policy exclusion (self-inflicted injury) | REJECTED — `EXCLUDED_CONDITION` | ✅ |
| EX05 | Prior claims already total the annual limit | REJECTED — `ANNUAL_LIMIT_EXCEEDED` | ✅ |

All 15 were run against a live instance of the deployed rules engine and
LLM extraction pipeline — not the automated test suite's fixture data. The
automated suite (`npm test`, 44 tests) covers the rules engine in isolation
plus these same 10 required scenarios and more; this document additionally
confirms the *full* pipeline (document → AI extraction → adjudication →
UI) end to end, the way an actual claimant would use it.

Beyond the 15 required/supplementary scenarios above, this guide also
covers the three bonus features built after the core assignment: **AI
accuracy metrics**, the **appeals workflow**, and **admin-configurable
policy** — see the dedicated section at the end.

---

## TC001 — Simple Consultation, Approved

**Input**: Rajesh Kumar (EMP001), viral fever, ₹1,500 consultation + diagnostics.
**Expected**: `APPROVED`, ₹1,350 (₹1,500 minus the standard 10% consultation copay).

![TC001](user-guide-screenshots/TC001.png)

## TC002 — Dental Treatment, Partial Approval

**Input**: Priya Singh (EMP002), root canal (₹8,000) plus teeth whitening (₹4,000).
**Expected**: `PARTIAL` — ₹8,000 approved, whitening rejected as a cosmetic
procedure.

![TC002](user-guide-screenshots/TC002.png)

## TC003 — Per-Claim Limit Exceeded

**Input**: Amit Verma (EMP003), ₹7,500 claim — above the ₹5,000 per-claim limit.
**Expected**: `REJECTED` — `PER_CLAIM_EXCEEDED`.

![TC003](user-guide-screenshots/TC003.png)

## TC004 — Missing Documents

**Input**: Sneha Reddy (EMP004), bill submitted with no prescription.
**Expected**: `REJECTED` — `MISSING_DOCUMENTS`.

![TC004](user-guide-screenshots/TC004.png)

## TC005 — Pre-existing Condition, Waiting Period

**Input**: Vikram Joshi (EMP005), joined 2024-09-01, diabetes treatment on
2024-10-15 — inside diabetes' 90-day specific waiting period.
**Expected**: `REJECTED` — `WAITING_PERIOD`, eligible from 2024-11-30.

![TC005](user-guide-screenshots/TC005.png)

## TC006 — Alternative Medicine, Approved

**Input**: Kavita Nair (EMP006), Ayurvedic Panchakarma therapy, ₹4,000.
**Expected**: `APPROVED`, ₹4,000 in full (alternative medicine has no copay).

![TC006](user-guide-screenshots/TC006.png)

## TC007 — Diagnostic Test Requiring Pre-Authorization

**Input**: Suresh Patil (EMP007), MRI scan, ₹15,000, no pre-authorization obtained.
**Expected**: `REJECTED` — `PRE_AUTH_MISSING`.

![TC007](user-guide-screenshots/TC007.png)

## TC008 — Fraud Indicator, Routed to Manual Review

**Input**: Ravi Menon (EMP008), 4th claim submitted the same day.
**Expected**: `MANUAL_REVIEW`, flagged for multiple same-day claims.

![TC008](user-guide-screenshots/TC008.png)

## TC009 — Named Exclusion, Rejected

**Input**: Anita Desai (EMP009), weight-loss/bariatric consultation.
**Expected**: `REJECTED` — `SERVICE_NOT_COVERED`.

![TC009](user-guide-screenshots/TC009.png)

## TC010 — Network Hospital, Cashless Approval

**Input**: Deepak Shah (EMP010), Apollo Hospitals (in-network), cashless requested, ₹4,500.
**Expected**: `APPROVED`, ₹3,600 (20% network discount), cashless approved.

![TC010](user-guide-screenshots/TC010.png)

## EX01 — Duplicate Claim

**Input**: Neha Kapoor (EMP011), the exact same member + treatment date +
amount submitted a second time.
**Expected**: `REJECTED` — `DUPLICATE_CLAIM`, referencing the original claim.

![EX01](user-guide-screenshots/EX01.png)

## EX02 — Invalid Doctor Registration Format

**Input**: Arjun Mehta (EMP012), doctor registration number `12345` (doesn't
match the required `[State]/[Number]/[Year]` format).
**Expected**: `REJECTED` — `DOCTOR_REG_INVALID`.

![EX02](user-guide-screenshots/EX02.png)

## EX03 — Member Not on the Roster

**Input**: Member ID `EMP500`, not present in `data/member_roster.json`.
**Expected**: `REJECTED` — `MEMBER_NOT_COVERED`.

![EX03](user-guide-screenshots/EX03.png)

## EX04 — Named Policy Exclusion (Self-Inflicted Injury)

**Input**: Sanjay Kumar (EMP013), diagnosis explicitly names a self-inflicted injury.
**Expected**: `REJECTED` — `EXCLUDED_CONDITION`.

![EX04](user-guide-screenshots/EX04.png)

## EX05 — Annual Limit Exceeded

**Input**: Kiran Rao (EMP014) — 10 prior claims this year already approved
in full at ₹5,000 each (₹50,000 total, at the policy's annual limit), then
one more ₹500 claim submitted.
**Expected**: `REJECTED` — `ANNUAL_LIMIT_EXCEEDED`, since the new claim
would push the year's total over ₹50,000.

![EX05](user-guide-screenshots/EX05.png)

---

# Bonus features

Three of the six bonus items listed in the assignment brief were built:
**AI accuracy metrics**, an **appeals workflow**, and **admin-configurable
policy**. All three were live-verified the same way as every scenario
above — real actions against a running instance, not mocked screenshots.

## AI Extraction Accuracy

A new section on the main dashboard (`/claims`) surfaces the LLM's own
self-reported extraction confidence in aggregate: the average across every
document processed, a four-bucket distribution (illegible / low / good /
high), and how often low confidence actually routed a claim to manual
review versus the document failing to extract at all. All of it is derived
from data the app was already storing (`ExtractedData.extractionConfidence`,
`Decision.flags`) — nothing new to collect, just surfaced. Labeled plainly
as *"self-reported confidence, not verified against ground truth"* rather
than implying more rigor than it has.

![AI accuracy metrics](user-guide-screenshots/ai-accuracy-metrics.png)

## Appeals Workflow

A `REJECTED` or `PARTIAL` claim can be appealed with a short reason,
directly from the claim detail page:

![Appeal form](user-guide-screenshots/appeal-form.png)

Once submitted, the appeal shows as pending review on the same page:

![Appeal pending](user-guide-screenshots/appeal-pending.png)

An administrator (a separate credential from the regular login — see
below) reviews it in a dedicated queue at `/admin/appeals` and either
upholds the original decision or overturns it with a note and an approved
amount, capped at the claim's originally submitted amount:

![Admin appeals queue](user-guide-screenshots/admin-appeals-queue.png)

Overturning updates the claim's effective status to `Approved` — but the
original rule-engine decision and its full trail are never rewritten; the
override is layered on top as a permanent, separate record, visible
alongside the original:

![Appeal overturned, decision preserved](user-guide-screenshots/appeal-overturned.png)

**Live-verified, not just built**: tried overturning with an amount above
the submitted claim total first — correctly rejected before the real
resolution went through — then resolved it for real with a valid amount.

## Admin-Configurable Policy

Coverage limits, copay/discount rates, waiting periods, exclusions, and the
network hospital list are all editable at `/admin/policy` — no redeploy
needed. This is the same data the rules engine actually reads for every
claim (`lib/db/policyConfig.ts`), not a separate copy that could drift out
of sync.

![Admin policy configuration](user-guide-screenshots/admin-policy-config.png)

**Live-verified that an edit actually changes engine behavior**, not just
saves to an unread database row: lowered the per-claim limit through this
form, resubmitted a claim that had approved moments before at the old
limit, watched it correctly reject `PER_CLAIM_EXCEEDED` under the new one,
then restored the original value.

## A separate admin credential, on purpose

All three `/admin/*` pages and their API routes require a second,
independent login (`/admin/login`) — a static password (`ADMIN_PASSWORD`)
distinct from the daily-rotating demo password, never displayed anywhere,
required *on top of* the regular session, not instead of it. Editing policy
or overturning a decision is a materially more consequential action than
viewing or submitting a claim, so it has its own, stronger gate. Tested
live: a session with only the regular login gets redirected away from
every single admin route — page or API — with no exceptions.
