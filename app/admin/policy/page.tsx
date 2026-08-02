"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { PolicyTermsInput } from "@/lib/api/policySchema";
import AdminLogoutButton from "@/components/AdminLogoutButton";

function NumberField({
  label,
  value,
  onChange,
  suffix,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  suffix?: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-widest">{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="border border-on-secondary-fixed-variant/15 rounded-lg px-3 py-2 font-data-mono text-data-mono bg-surface-container-lowest w-full"
        />
        {suffix && <span className="font-body-sm text-body-sm text-on-surface-variant shrink-0">{suffix}</span>}
      </div>
    </label>
  );
}

function ToggleField({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} className="rounded" />
      <span className="font-body-sm text-body-sm text-on-surface">{label}</span>
    </label>
  );
}

function ListField({ label, value, onChange }: { label: string; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-widest">
        {label} <span className="normal-case font-body-sm text-[11px]">(one per line)</span>
      </span>
      <textarea
        value={value.join("\n")}
        onChange={(e) => onChange(e.target.value.split("\n").map((s) => s.trim()).filter(Boolean))}
        rows={Math.min(8, Math.max(3, value.length))}
        className="border border-on-secondary-fixed-variant/15 rounded-lg px-3 py-2 font-body-sm text-body-sm bg-surface-container-lowest resize-y"
      />
    </label>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="card-surface p-padding-card border border-on-secondary-fixed/10 rounded-lg flex flex-col gap-stack-sm">
      <legend className="font-headline-sm text-headline-sm text-on-surface px-1">{title}</legend>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-stack-md">{children}</div>
    </fieldset>
  );
}

export default function AdminPolicyPage() {
  const [policy, setPolicy] = useState<PolicyTermsInput | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/admin/policy")
      .then((r) => r.json())
      .then((data) => setPolicy(data.policy));
  }, []);

  async function handleSave() {
    if (!policy) return;
    setSaving(true);
    setMessage(null);
    const res = await fetch("/api/admin/policy", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(policy),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setMessage({ kind: "error", text: data.error ?? "Couldn't save the policy." });
      setSaving(false);
      return;
    }
    setMessage({ kind: "success", text: "Saved — every claim submitted from now on uses this policy." });
    setSaving(false);
  }

  if (!policy) {
    return (
      <div className="bg-surface min-h-screen flex items-center justify-center font-body-sm text-body-sm text-on-surface-variant">
        Loading…
      </div>
    );
  }

  const cd = policy.coverage_details;

  return (
    <div className="bg-surface font-body-md text-on-surface antialiased min-h-screen pb-24">
      <header className="bg-on-secondary-fixed min-h-16 flex flex-wrap items-center justify-between gap-2 px-margin-page py-3 sticky top-0 z-10">
        <span className="font-display-md text-display-md text-surface-bright">Policy Configuration</span>
        <div className="flex flex-wrap items-center gap-stack-md">
          <Link href="/admin" className="font-label-caps text-label-caps text-surface-bright/70 hover:text-surface-bright">
            ← Admin home
          </Link>
          <AdminLogoutButton className="font-label-caps text-label-caps text-surface-bright/70 hover:text-surface-bright transition-colors" />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-margin-page py-stack-lg flex flex-col gap-stack-md">
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          Changes take effect for every claim submitted after saving. Existing claims and their decisions are
          never retroactively recomputed.
        </p>

        <Section title="Overall limits">
          <NumberField label="Annual limit" suffix="₹" value={cd.annual_limit} onChange={(v) => setPolicy({ ...policy, coverage_details: { ...cd, annual_limit: v } })} />
          <NumberField label="Per-claim limit" suffix="₹" value={cd.per_claim_limit} onChange={(v) => setPolicy({ ...policy, coverage_details: { ...cd, per_claim_limit: v } })} />
          <NumberField label="Family floater limit" suffix="₹" value={cd.family_floater_limit} onChange={(v) => setPolicy({ ...policy, coverage_details: { ...cd, family_floater_limit: v } })} />
          <NumberField label="Minimum claim amount" suffix="₹" value={policy.claim_requirements.minimum_claim_amount} onChange={(v) => setPolicy({ ...policy, claim_requirements: { ...policy.claim_requirements, minimum_claim_amount: v } })} />
          <NumberField label="Submission timeline" suffix="days" value={policy.claim_requirements.submission_timeline_days} onChange={(v) => setPolicy({ ...policy, claim_requirements: { ...policy.claim_requirements, submission_timeline_days: v } })} />
        </Section>

        <Section title="Consultation">
          <NumberField label="Sub-limit" suffix="₹" value={cd.consultation_fees.sub_limit} onChange={(v) => setPolicy({ ...policy, coverage_details: { ...cd, consultation_fees: { ...cd.consultation_fees, sub_limit: v } } })} />
          <NumberField label="Copay" suffix="%" value={cd.consultation_fees.copay_percentage} onChange={(v) => setPolicy({ ...policy, coverage_details: { ...cd, consultation_fees: { ...cd.consultation_fees, copay_percentage: v } } })} />
          <NumberField label="Network discount" suffix="%" value={cd.consultation_fees.network_discount} onChange={(v) => setPolicy({ ...policy, coverage_details: { ...cd, consultation_fees: { ...cd.consultation_fees, network_discount: v } } })} />
          <ToggleField label="Covered" value={cd.consultation_fees.covered} onChange={(v) => setPolicy({ ...policy, coverage_details: { ...cd, consultation_fees: { ...cd.consultation_fees, covered: v } } })} />
        </Section>

        <Section title="Diagnostic tests">
          <NumberField label="Sub-limit" suffix="₹" value={cd.diagnostic_tests.sub_limit} onChange={(v) => setPolicy({ ...policy, coverage_details: { ...cd, diagnostic_tests: { ...cd.diagnostic_tests, sub_limit: v } } })} />
          <ToggleField label="Pre-authorization required" value={cd.diagnostic_tests.pre_authorization_required} onChange={(v) => setPolicy({ ...policy, coverage_details: { ...cd, diagnostic_tests: { ...cd.diagnostic_tests, pre_authorization_required: v } } })} />
          <div className="md:col-span-2">
            <ListField label="Covered tests" value={cd.diagnostic_tests.covered_tests} onChange={(v) => setPolicy({ ...policy, coverage_details: { ...cd, diagnostic_tests: { ...cd.diagnostic_tests, covered_tests: v } } })} />
          </div>
        </Section>

        <Section title="Pharmacy">
          <NumberField label="Sub-limit" suffix="₹" value={cd.pharmacy.sub_limit} onChange={(v) => setPolicy({ ...policy, coverage_details: { ...cd, pharmacy: { ...cd.pharmacy, sub_limit: v } } })} />
          <NumberField label="Branded drugs copay" suffix="%" value={cd.pharmacy.branded_drugs_copay} onChange={(v) => setPolicy({ ...policy, coverage_details: { ...cd, pharmacy: { ...cd.pharmacy, branded_drugs_copay: v } } })} />
          <ToggleField label="Generic drugs mandatory" value={cd.pharmacy.generic_drugs_mandatory} onChange={(v) => setPolicy({ ...policy, coverage_details: { ...cd, pharmacy: { ...cd.pharmacy, generic_drugs_mandatory: v } } })} />
        </Section>

        <Section title="Dental">
          <NumberField label="Sub-limit" suffix="₹" value={cd.dental.sub_limit} onChange={(v) => setPolicy({ ...policy, coverage_details: { ...cd, dental: { ...cd.dental, sub_limit: v } } })} />
          <NumberField label="Routine checkup limit" suffix="₹" value={cd.dental.routine_checkup_limit} onChange={(v) => setPolicy({ ...policy, coverage_details: { ...cd, dental: { ...cd.dental, routine_checkup_limit: v } } })} />
          <ToggleField label="Cosmetic procedures covered" value={cd.dental.cosmetic_procedures} onChange={(v) => setPolicy({ ...policy, coverage_details: { ...cd, dental: { ...cd.dental, cosmetic_procedures: v } } })} />
          <div className="md:col-span-2">
            <ListField label="Procedures covered" value={cd.dental.procedures_covered} onChange={(v) => setPolicy({ ...policy, coverage_details: { ...cd, dental: { ...cd.dental, procedures_covered: v } } })} />
          </div>
        </Section>

        <Section title="Vision">
          <NumberField label="Sub-limit" suffix="₹" value={cd.vision.sub_limit} onChange={(v) => setPolicy({ ...policy, coverage_details: { ...cd, vision: { ...cd.vision, sub_limit: v } } })} />
          <ToggleField label="Eye test covered" value={cd.vision.eye_test_covered} onChange={(v) => setPolicy({ ...policy, coverage_details: { ...cd, vision: { ...cd.vision, eye_test_covered: v } } })} />
          <ToggleField label="Glasses/contact lenses covered" value={cd.vision.glasses_contact_lenses} onChange={(v) => setPolicy({ ...policy, coverage_details: { ...cd, vision: { ...cd.vision, glasses_contact_lenses: v } } })} />
          <ToggleField label="LASIK surgery covered" value={cd.vision.lasik_surgery} onChange={(v) => setPolicy({ ...policy, coverage_details: { ...cd, vision: { ...cd.vision, lasik_surgery: v } } })} />
        </Section>

        <Section title="Alternative medicine">
          <NumberField label="Sub-limit" suffix="₹" value={cd.alternative_medicine.sub_limit} onChange={(v) => setPolicy({ ...policy, coverage_details: { ...cd, alternative_medicine: { ...cd.alternative_medicine, sub_limit: v } } })} />
          <NumberField label="Therapy sessions limit" value={cd.alternative_medicine.therapy_sessions_limit} onChange={(v) => setPolicy({ ...policy, coverage_details: { ...cd, alternative_medicine: { ...cd.alternative_medicine, therapy_sessions_limit: v } } })} />
          <div className="md:col-span-2">
            <ListField label="Covered treatments" value={cd.alternative_medicine.covered_treatments} onChange={(v) => setPolicy({ ...policy, coverage_details: { ...cd, alternative_medicine: { ...cd.alternative_medicine, covered_treatments: v } } })} />
          </div>
        </Section>

        <Section title="Waiting periods (days)">
          <NumberField label="Initial waiting" value={policy.waiting_periods.initial_waiting} onChange={(v) => setPolicy({ ...policy, waiting_periods: { ...policy.waiting_periods, initial_waiting: v } })} />
          <NumberField label="Pre-existing diseases" value={policy.waiting_periods.pre_existing_diseases} onChange={(v) => setPolicy({ ...policy, waiting_periods: { ...policy.waiting_periods, pre_existing_diseases: v } })} />
          <NumberField label="Maternity" value={policy.waiting_periods.maternity} onChange={(v) => setPolicy({ ...policy, waiting_periods: { ...policy.waiting_periods, maternity: v } })} />
          {Object.entries(policy.waiting_periods.specific_ailments).map(([ailment, days]) => (
            <NumberField
              key={ailment}
              label={ailment.replace(/_/g, " ")}
              value={days}
              onChange={(v) =>
                setPolicy({
                  ...policy,
                  waiting_periods: {
                    ...policy.waiting_periods,
                    specific_ailments: { ...policy.waiting_periods.specific_ailments, [ailment]: v },
                  },
                })
              }
            />
          ))}
        </Section>

        <Section title="Exclusions &amp; network">
          <div className="md:col-span-2">
            <ListField label="Excluded conditions/treatments" value={policy.exclusions} onChange={(v) => setPolicy({ ...policy, exclusions: v })} />
          </div>
          <div className="md:col-span-2">
            <ListField label="Network hospitals" value={policy.network_hospitals} onChange={(v) => setPolicy({ ...policy, network_hospitals: v })} />
          </div>
        </Section>

        <Section title="Cashless facilities">
          <ToggleField label="Available" value={policy.cashless_facilities.available} onChange={(v) => setPolicy({ ...policy, cashless_facilities: { ...policy.cashless_facilities, available: v } })} />
          <ToggleField label="Network hospitals only" value={policy.cashless_facilities.network_only} onChange={(v) => setPolicy({ ...policy, cashless_facilities: { ...policy.cashless_facilities, network_only: v } })} />
          <ToggleField label="Pre-approval required" value={policy.cashless_facilities.pre_approval_required} onChange={(v) => setPolicy({ ...policy, cashless_facilities: { ...policy.cashless_facilities, pre_approval_required: v } })} />
          <NumberField label="Instant approval limit" suffix="₹" value={policy.cashless_facilities.instant_approval_limit} onChange={(v) => setPolicy({ ...policy, cashless_facilities: { ...policy.cashless_facilities, instant_approval_limit: v } })} />
        </Section>

        {message && (
          <p className={`font-body-sm text-body-sm ${message.kind === "success" ? "text-[#137333]" : "text-error"}`}>
            {message.text}
          </p>
        )}

        <button
          onClick={handleSave}
          disabled={saving}
          className="self-start bg-primary text-on-primary font-label-caps text-label-caps px-8 py-3 rounded-lg hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save Policy"}
        </button>
      </main>
    </div>
  );
}
