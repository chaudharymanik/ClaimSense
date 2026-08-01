import Link from "next/link";
import TopNav from "@/components/TopNav";
import { POLICY } from "@/lib/rules-engine/policy";

// Everything on this page is read directly from policy_terms.json (same
// POLICY object the rules engine itself uses) — never hardcoded separately,
// so this page can't drift out of sync with what the engine actually
// enforces. No per-request data, so this can be statically prerendered.

const CATEGORY_ROWS: Array<{
  label: string;
  key: keyof typeof POLICY.coverage_details;
  note?: (c: (typeof POLICY.coverage_details)["consultation_fees"]) => string;
}> = [
  {
    label: "Doctor Consultation",
    key: "consultation_fees",
    note: (c) =>
      `${c.copay_percentage}% co-pay applies (non-network). At a network hospital, a ${c.network_discount}% discount applies instead — no co-pay.`,
  },
  {
    label: "Diagnostic Tests",
    key: "diagnostic_tests",
  },
  {
    label: "Pharmacy",
    key: "pharmacy",
  },
  {
    label: "Dental",
    key: "dental",
  },
  {
    label: "Vision",
    key: "vision",
  },
  {
    label: "Alternative Medicine",
    key: "alternative_medicine",
  },
];

function preAuthTests(): string[] {
  return POLICY.coverage_details.diagnostic_tests.covered_tests
    .filter((t) => t.includes("with pre-auth"))
    .map((t) => t.replace(/\s*\(with pre-auth\)/i, ""));
}

export default function CoverageGuidePage() {
  const c = POLICY.coverage_details;
  const wp = POLICY.waiting_periods;
  const preAuth = preAuthTests();

  return (
    <div className="bg-background text-on-background font-body-md antialiased min-h-screen flex flex-col">
      <TopNav active="new-claim" />
      <main className="flex-grow w-full max-w-[1000px] mx-auto px-margin-page py-margin-page flex flex-col gap-stack-lg">
        <header>
          <p className="font-label-caps text-label-caps text-secondary tracking-widest mb-unit uppercase">
            {POLICY.policy_name}
          </p>
          <h1 className="font-display-lg text-display-lg text-on-secondary-fixed">
            What&apos;s <span className="italic text-primary">covered</span>
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant mt-stack-sm">
            A plain-language guide to your policy — check this before submitting so you know what to
            expect. <Link href="/claims/new" className="text-primary underline">Back to claim submission →</Link>
          </p>
        </header>

        <section className="card-surface p-padding-card">
          <h2 className="font-headline-sm text-headline-sm text-on-surface mb-stack-md">Overall Limits</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-stack-md">
            <LimitStat label="Annual Limit" value={`₹${c.annual_limit.toLocaleString("en-IN")}`} />
            <LimitStat label="Per-Claim Limit" value={`₹${c.per_claim_limit.toLocaleString("en-IN")}`} />
            <LimitStat label="Family Floater" value={`₹${c.family_floater_limit.toLocaleString("en-IN")}`} />
          </div>
          <p className="font-body-sm text-body-sm text-on-surface-variant mt-stack-md">
            Minimum claim amount: ₹{POLICY.claim_requirements.minimum_claim_amount} · Must be submitted
            within {POLICY.claim_requirements.submission_timeline_days} days of treatment.
          </p>
        </section>

        <section className="card-surface p-padding-card">
          <h2 className="font-headline-sm text-headline-sm text-on-surface mb-stack-md">Coverage Categories</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-on-secondary-fixed/10">
                  <th className="py-2 pr-stack-md font-label-caps text-label-caps text-on-surface-variant uppercase">Category</th>
                  <th className="py-2 pr-stack-md font-label-caps text-label-caps text-on-surface-variant uppercase text-right">Sub-limit</th>
                  <th className="py-2 font-label-caps text-label-caps text-on-surface-variant uppercase">Notes</th>
                </tr>
              </thead>
              <tbody className="font-body-sm text-body-sm">
                {CATEGORY_ROWS.map((row) => {
                  const detail = c[row.key] as { sub_limit: number };
                  return (
                    <tr key={row.key} className="border-b border-on-secondary-fixed/10 last:border-b-0">
                      <td className="py-3 pr-stack-md font-medium text-on-surface">{row.label}</td>
                      <td className="py-3 pr-stack-md text-right font-data-mono text-data-mono">
                        ₹{detail.sub_limit.toLocaleString("en-IN")}
                      </td>
                      <td className="py-3 text-on-surface-variant">
                        {row.key === "consultation_fees" && row.note?.(c.consultation_fees)}
                        {row.key === "pharmacy" &&
                          `Generic drugs required where available; ${c.pharmacy.branded_drugs_copay}% co-pay on branded drugs.`}
                        {row.key === "dental" &&
                          `Covers ${c.dental.procedures_covered.join(", ").toLowerCase()}. Cosmetic procedures (e.g. whitening) are not covered.`}
                        {row.key === "vision" &&
                          `Eye tests and glasses/contact lenses covered. LASIK surgery is not covered.`}
                        {row.key === "alternative_medicine" &&
                          `Covers ${c.alternative_medicine.covered_treatments.join(", ")}. Up to ${c.alternative_medicine.therapy_sessions_limit} therapy sessions.`}
                        {row.key === "diagnostic_tests" && "See pre-authorization note below for MRI/CT scans."}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card-surface p-padding-card border-l-4 border-l-primary">
          <h2 className="font-headline-sm text-headline-sm text-on-surface mb-stack-sm flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">warning</span>
            Pre-Authorization Required
          </h2>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            These tests require pre-authorization <strong>before</strong> the procedure — submitting a
            claim afterward without it will be rejected regardless of amount:
          </p>
          <ul className="list-disc list-inside font-body-sm text-body-sm text-on-surface mt-unit">
            {preAuth.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </section>

        <section className="card-surface p-padding-card">
          <h2 className="font-headline-sm text-headline-sm text-on-surface mb-stack-md">Waiting Periods</h2>
          <p className="font-body-sm text-body-sm text-on-surface-variant mb-stack-md">
            Counted from your policy join date. Treatment during the waiting period for that condition
            will be rejected.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-stack-md">
            <LimitStat label="Any treatment (initial)" value={`${wp.initial_waiting} days`} />
            <LimitStat label="Pre-existing diseases" value={`${wp.pre_existing_diseases} days`} />
            <LimitStat label="Maternity" value={`${wp.maternity} days`} />
            <LimitStat label="Diabetes" value={`${wp.specific_ailments.diabetes} days`} />
            <LimitStat label="Hypertension" value={`${wp.specific_ailments.hypertension} days`} />
            <LimitStat label="Joint replacement" value={`${wp.specific_ailments.joint_replacement} days`} />
          </div>
        </section>

        <section className="card-surface p-padding-card">
          <h2 className="font-headline-sm text-headline-sm text-on-surface mb-stack-sm">Not Covered</h2>
          <div className="flex flex-wrap gap-2">
            {POLICY.exclusions.map((e) => (
              <span
                key={e}
                className="inline-flex items-center px-2.5 py-1 rounded-full bg-error-container text-on-error-container font-label-caps text-label-caps"
              >
                {e}
              </span>
            ))}
          </div>
        </section>

        <section className="card-surface p-padding-card">
          <h2 className="font-headline-sm text-headline-sm text-on-surface mb-stack-sm">Network Hospitals (Cashless)</h2>
          <p className="font-body-sm text-body-sm text-on-surface-variant mb-stack-md">
            At these hospitals you get a {c.consultation_fees.network_discount}% discount instead of the
            usual co-pay, and claims up to ₹{POLICY.cashless_facilities.instant_approval_limit.toLocaleString("en-IN")} qualify
            for instant cashless approval.
          </p>
          <div className="flex flex-wrap gap-2">
            {POLICY.network_hospitals.map((h) => (
              <span
                key={h}
                className="inline-flex items-center px-2.5 py-1 rounded-full bg-secondary-container text-on-secondary-container font-label-caps text-label-caps"
              >
                {h}
              </span>
            ))}
          </div>
        </section>

        <section className="card-surface p-padding-card">
          <h2 className="font-headline-sm text-headline-sm text-on-surface mb-stack-sm">Documents You&apos;ll Need</h2>
          <ul className="list-disc list-inside font-body-sm text-body-sm text-on-surface-variant">
            {POLICY.claim_requirements.documents_required.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}

function LimitStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface-container-low rounded-lg p-stack-md">
      <p className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wider mb-1">{label}</p>
      <p className="font-data-mono text-data-mono text-on-surface text-lg font-medium">{value}</p>
    </div>
  );
}
