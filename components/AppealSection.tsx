"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export interface AppealInfo {
  id: string;
  reason: string;
  status: "PENDING" | "UPHELD" | "OVERTURNED";
  resolutionNote: string | null;
  overrideAmount: number | null;
  createdAt: string;
}

const STATUS_STYLE: Record<AppealInfo["status"], string> = {
  PENDING: "bg-outline-variant text-on-surface-variant",
  UPHELD: "bg-error-container text-on-error-container",
  OVERTURNED: "bg-[#e6f4ea] text-[#137333]",
};

function AppealForm({ claimId }: { claimId: string }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/claims/${claimId}/appeal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Couldn't submit the appeal.");
        setSubmitting(false);
        return;
      }
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-stack-sm">
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Why should this decision be reconsidered?"
        rows={3}
        maxLength={1000}
        className="border border-on-secondary-fixed-variant/15 rounded-lg px-3 py-2 font-body-sm text-body-sm text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 bg-surface-container-lowest transition-all resize-y"
      />
      {error && <p className="font-body-sm text-body-sm text-error">{error}</p>}
      <button
        type="submit"
        disabled={submitting || reason.trim().length === 0}
        className="self-start bg-primary text-on-primary font-label-caps text-label-caps px-5 py-2 rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-60"
      >
        {submitting ? "Submitting…" : "Submit Appeal"}
      </button>
    </form>
  );
}

export default function AppealSection({
  claimId,
  appealable,
  appeal,
}: {
  claimId: string;
  appealable: boolean;
  appeal: AppealInfo | null;
}) {
  if (!appealable && !appeal) return null;

  return (
    <section className="card-surface p-padding-card flex flex-col gap-stack-sm">
      <h2 className="font-headline-sm text-headline-sm text-on-surface border-b hairline-divider pb-unit">
        Appeal
      </h2>

      {!appeal && appealable && (
        <>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            Disagree with this decision? Submit an appeal for a claims administrator to review.
          </p>
          <AppealForm claimId={claimId} />
        </>
      )}

      {appeal && (
        <div className="flex flex-col gap-stack-sm">
          <div className="flex items-center gap-stack-sm">
            <span className={`font-label-caps text-label-caps px-2.5 py-1 rounded-full ${STATUS_STYLE[appeal.status]}`}>
              {appeal.status === "PENDING" ? "Pending Review" : appeal.status === "UPHELD" ? "Upheld" : "Overturned"}
            </span>
          </div>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            <span className="font-semibold text-on-surface">Reason given: </span>
            {appeal.reason}
          </p>
          {appeal.resolutionNote && (
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              <span className="font-semibold text-on-surface">Administrator&apos;s note: </span>
              {appeal.resolutionNote}
            </p>
          )}
          {appeal.status === "OVERTURNED" && appeal.overrideAmount !== null && (
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              <span className="font-semibold text-on-surface">Overridden approved amount: </span>
              <span className="font-data-mono">₹{appeal.overrideAmount.toLocaleString("en-IN")}</span> — the
              original rule-engine decision above is kept as-is for the audit trail; this override is layered on top.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
