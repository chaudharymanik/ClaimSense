"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import TopNav from "@/components/TopNav";
import { POLICY } from "@/lib/rules-engine/policy";

const POLICY_EFFECTIVE_DATE = POLICY.effective_date;

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1] ?? "");
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Mirrors the real pipeline order in lib/api/processClaim.ts (extract, then
// adjudicate) — this is an honest reflection of what's actually happening,
// not a fake progress bar. The client can't see real server-side progress
// without adding websockets/SSE, so it auto-advances on a timer and stops
// at the last step until the request actually resolves.
const PROCESSING_STEPS = [
  "Reading document…",
  "Extracting details with AI…",
  "Checking policy rules…",
  "Finalizing decision…",
];

export default function NewClaimPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);

    const documentText = String(form.get("documentText") ?? "").trim();
    if (!documentText && !file) {
      setError("Provide either document text or an uploaded file.");
      return;
    }

    setSubmitting(true);
    setStepIndex(0);
    const stepTimer = setInterval(() => {
      setStepIndex((i) => Math.min(i + 1, PROCESSING_STEPS.length - 1));
    }, 1500);

    try {
      const payload: Record<string, unknown> = {
        member_id: String(form.get("memberId") ?? ""),
        member_name: String(form.get("memberName") ?? ""),
        treatment_date: String(form.get("treatmentDate") ?? ""),
        member_join_date: String(form.get("memberJoinDate") ?? "") || undefined,
        claim_amount: Number(form.get("claimAmount") ?? 0),
        hospital: String(form.get("hospital") ?? "") || undefined,
        cashless_request: form.get("cashlessRequest") === "on",
      };
      if (documentText) payload.document_text = documentText;
      if (file) {
        payload.document_file_base64 = await fileToBase64(file);
        payload.document_file_mime = file.type;
      }

      const res = await fetch("/api/claims", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to submit claim");
      }
      clearInterval(stepTimer);
      router.push(`/claims/${data.claimId}`);
    } catch (err) {
      clearInterval(stepTimer);
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSubmitting(false);
    }
  }

  return (
    <div className="bg-surface font-body-md text-on-surface antialiased min-h-screen flex flex-col">
      <TopNav active="new-claim" />
      <main className="flex-grow flex justify-center items-start pt-margin-page pb-margin-page px-unit md:px-margin-page w-full max-w-[1440px] mx-auto">
        <div className="bg-surface-container-lowest border border-on-secondary-fixed/10 rounded-xl p-padding-card w-full max-w-3xl shadow-sm">
          <header className="mb-stack-lg border-b border-on-secondary-fixed/10 pb-stack-md">
            <h1 className="font-display-lg text-display-lg text-on-surface">
              Submit a <span className="italic">new</span> claim
            </h1>
            <p className="font-body-md text-body-md text-on-surface-variant mt-stack-sm">
              Enter the details below to initiate a new automated adjudication process.
            </p>
            <Link
              href="/claims/coverage"
              className="inline-flex items-center gap-1 font-body-sm text-body-sm text-primary hover:underline mt-stack-sm"
            >
              <span className="material-symbols-outlined text-[16px]">help</span>
              Not sure what&apos;s covered? See waiting periods, limits &amp; network hospitals
            </Link>
          </header>

          <form className="flex flex-col gap-gutter-grid" onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-gutter-grid">
              <Field label="Member ID">
                <input
                  name="memberId"
                  required
                  placeholder="e.g. EMP001"
                  className="border border-on-secondary-fixed/15 rounded-lg px-3 py-2 font-data-mono text-data-mono text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 bg-surface-container-lowest transition-all"
                />
              </Field>
              <Field label="Member Name">
                <input
                  name="memberName"
                  required
                  placeholder="Jane Doe"
                  className="border border-on-secondary-fixed/15 rounded-lg px-3 py-2 font-body-md text-body-md text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 bg-surface-container-lowest transition-all"
                />
              </Field>
              <Field label="Treatment Date">
                <input
                  name="treatmentDate"
                  type="date"
                  required
                  className="border border-on-secondary-fixed/15 rounded-lg px-3 py-2 font-data-mono text-data-mono text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 bg-surface-container-lowest transition-all"
                />
              </Field>
              <Field label="Claim Amount">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-data-mono text-data-mono text-on-surface-variant">
                    ₹
                  </span>
                  <input
                    name="claimAmount"
                    type="number"
                    min="0"
                    step="1"
                    required
                    placeholder="0"
                    className="border border-on-secondary-fixed/15 rounded-lg pl-7 pr-3 py-2 font-data-mono text-data-mono text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 bg-surface-container-lowest transition-all w-full"
                  />
                </div>
              </Field>
              <Field label="Member Join Date (optional)">
                <input
                  name="memberJoinDate"
                  type="date"
                  className="border border-on-secondary-fixed/15 rounded-lg px-3 py-2 font-data-mono text-data-mono text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 bg-surface-container-lowest transition-all"
                />
                <p className="font-body-sm text-body-sm text-on-surface-variant/70 text-xs">
                  Needed to check waiting periods — if left blank, we assume you&apos;ve been enrolled
                  since the policy started ({POLICY_EFFECTIVE_DATE}).
                </p>
              </Field>
              <Field label="Hospital / Clinic (optional)">
                <input
                  name="hospital"
                  placeholder="e.g. Apollo Hospitals"
                  className="border border-on-secondary-fixed/15 rounded-lg px-3 py-2 font-body-md text-body-md text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 bg-surface-container-lowest transition-all"
                />
              </Field>
              <div className="flex flex-col gap-unit justify-end">
                <label className="flex items-center gap-2 py-2">
                  <input
                    name="cashlessRequest"
                    type="checkbox"
                    className="rounded border-on-secondary-fixed/30 text-primary focus:ring-primary/30"
                  />
                  <span className="font-body-sm text-body-sm text-on-surface-variant">
                    Request cashless settlement (network hospitals only)
                  </span>
                </label>
              </div>
            </div>

            <div className="flex flex-col gap-unit mt-stack-sm">
              <label
                className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-widest flex items-center justify-between"
                htmlFor="documentText"
              >
                <span>Prescription / Bill Document Text</span>
                <span className="material-symbols-outlined text-on-surface-variant/50 text-[16px]">
                  document_scanner
                </span>
              </label>
              <textarea
                id="documentText"
                name="documentText"
                rows={6}
                placeholder="Paste prescription/bill text here — or upload a photo/PDF below instead..."
                className="border border-on-secondary-fixed/15 rounded-lg px-3 py-2 font-body-sm text-body-sm text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 bg-surface-container-lowest transition-all resize-y"
              />
              <p className="font-body-sm text-body-sm text-on-surface-variant/70 text-xs">
                This text will be analyzed by the adjudication engine.
              </p>
            </div>

            <div className="flex flex-col gap-unit">
              <label
                className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-widest"
                htmlFor="documentFile"
              >
                Or upload a photo / PDF of the document
              </label>
              <input
                id="documentFile"
                type="file"
                accept="image/*,application/pdf"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="font-body-sm text-body-sm text-on-surface-variant file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:font-label-caps file:text-label-caps file:bg-surface-container-high file:text-on-surface hover:file:bg-surface-container-highest file:cursor-pointer cursor-pointer"
              />
              {file && (
                <p className="font-body-sm text-body-sm text-on-surface-variant/70 text-xs">
                  Selected: {file.name} — this will be read directly by the AI extraction step (no OCR needed).
                </p>
              )}
            </div>

            {error && (
              <p className="font-body-sm text-body-sm text-error bg-error-container rounded-lg px-3 py-2">{error}</p>
            )}

            {submitting && (
              <div className="flex items-center gap-2 text-primary" aria-live="polite">
                <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                <span className="font-body-sm text-body-sm">{PROCESSING_STEPS[stepIndex]}</span>
              </div>
            )}

            <div className="mt-stack-lg flex justify-end gap-stack-md pt-stack-md border-t border-on-secondary-fixed/10">
              <button
                type="button"
                onClick={() => router.push("/claims")}
                disabled={submitting}
                className="font-body-md text-body-md text-on-secondary-fixed px-6 py-2 rounded-lg hover:bg-surface-container-low transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="bg-primary text-on-primary font-body-md text-body-md px-8 py-2 rounded-lg hover:bg-surface-tint transition-colors flex items-center gap-2 shadow-sm disabled:opacity-60"
              >
                <span>{submitting ? "Processing…" : "Submit Claim"}</span>
                {!submitting && <span className="material-symbols-outlined text-[20px]">send</span>}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-unit">
      <label className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-widest">
        {label}
      </label>
      {children}
    </div>
  );
}
