"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { rejectionCodeLabel } from "@/lib/rejectionCodeLabels";
import AdminLogoutButton from "@/components/AdminLogoutButton";

interface AppealRow {
  id: string;
  reason: string;
  status: "PENDING" | "UPHELD" | "OVERTURNED";
  resolutionNote: string | null;
  overrideAmount: number | null;
  createdAt: string;
  claim: {
    id: string;
    memberName: string;
    claimAmount: number;
    status: string;
    decision: { decision: string; rejectionReasons: unknown; approvedAmount: number | null } | null;
  };
}

function ResolveForm({ appeal, onResolved }: { appeal: AppealRow; onResolved: () => void }) {
  const [note, setNote] = useState("");
  const [overrideAmount, setOverrideAmount] = useState(String(appeal.claim.claimAmount));
  const [submitting, setSubmitting] = useState<"UPHELD" | "OVERTURNED" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function resolve(status: "UPHELD" | "OVERTURNED") {
    setError(null);
    setSubmitting(status);
    const body: Record<string, unknown> = { status, resolutionNote: note };
    if (status === "OVERTURNED") body.overrideAmount = Number(overrideAmount);

    const res = await fetch(`/api/admin/appeals/${appeal.id}/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Couldn't resolve this appeal.");
      setSubmitting(null);
      return;
    }
    onResolved();
  }

  return (
    <div className="flex flex-col gap-stack-sm mt-stack-sm pt-stack-sm border-t hairline-divider">
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Resolution note — why upheld or overturned"
        rows={2}
        maxLength={1000}
        className="border border-on-secondary-fixed-variant/15 rounded-lg px-3 py-2 font-body-sm text-body-sm bg-surface-container-lowest resize-y"
      />
      <div className="flex items-center gap-stack-sm flex-wrap">
        <label className="font-body-sm text-body-sm text-on-surface-variant flex items-center gap-2">
          Override amount (₹, if overturning)
          <input
            type="number"
            min={0}
            max={appeal.claim.claimAmount}
            value={overrideAmount}
            onChange={(e) => setOverrideAmount(e.target.value)}
            className="border border-on-secondary-fixed-variant/15 rounded-lg px-2 py-1 font-data-mono text-data-mono w-28 bg-surface-container-lowest"
          />
        </label>
        <span className="font-body-sm text-[11px] text-on-surface-variant">
          capped at the submitted claim amount, ₹{appeal.claim.claimAmount.toLocaleString("en-IN")}
        </span>
      </div>
      {error && <p className="font-body-sm text-body-sm text-error">{error}</p>}
      <div className="flex gap-stack-sm">
        <button
          onClick={() => resolve("UPHELD")}
          disabled={submitting !== null || note.trim().length === 0}
          className="px-4 py-2 border border-on-secondary-fixed-variant/20 rounded-lg font-label-caps text-label-caps hover:bg-surface-container-low transition-colors disabled:opacity-60"
        >
          {submitting === "UPHELD" ? "Upholding…" : "Uphold Original Decision"}
        </button>
        <button
          onClick={() => resolve("OVERTURNED")}
          disabled={submitting !== null || note.trim().length === 0}
          className="px-4 py-2 bg-primary text-on-primary rounded-lg font-label-caps text-label-caps hover:bg-primary/90 transition-colors disabled:opacity-60"
        >
          {submitting === "OVERTURNED" ? "Overturning…" : "Overturn & Approve"}
        </button>
      </div>
    </div>
  );
}

export default function AdminAppealsPage() {
  const [appeals, setAppeals] = useState<AppealRow[] | null>(null);

  function load() {
    fetch("/api/admin/appeals")
      .then((r) => r.json())
      .then((data) => setAppeals(data.appeals ?? []));
  }

  useEffect(() => {
    load();
  }, []);

  const pending = appeals?.filter((a) => a.status === "PENDING") ?? [];
  const resolved = appeals?.filter((a) => a.status !== "PENDING") ?? [];

  return (
    <div className="bg-surface font-body-md text-on-surface antialiased min-h-screen">
      <header className="bg-on-secondary-fixed min-h-16 flex flex-wrap items-center justify-between gap-2 px-margin-page py-3">
        <span className="font-display-md text-display-md text-surface-bright">Appeals</span>
        <div className="flex flex-wrap items-center gap-stack-md">
          <Link href="/admin" className="font-label-caps text-label-caps text-surface-bright/70 hover:text-surface-bright">
            ← Admin home
          </Link>
          <AdminLogoutButton className="font-label-caps text-label-caps text-surface-bright/70 hover:text-surface-bright transition-colors" />
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-margin-page py-stack-lg flex flex-col gap-stack-lg">
        {appeals === null && <p className="font-body-sm text-body-sm text-on-surface-variant">Loading…</p>}

        {appeals !== null && (
          <>
            <section>
              <h2 className="font-headline-sm text-headline-sm text-on-surface mb-stack-sm">
                Pending ({pending.length})
              </h2>
              {pending.length === 0 ? (
                <p className="font-body-sm text-body-sm text-on-surface-variant">No pending appeals.</p>
              ) : (
                <div className="flex flex-col gap-stack-sm">
                  {pending.map((a) => (
                    <div key={a.id} className="card-surface p-padding-card border border-on-secondary-fixed/10 rounded-lg">
                      <div className="flex justify-between items-baseline">
                        <Link href={`/claims/${a.claim.id}`} className="font-body-md text-body-md font-semibold text-primary hover:underline">
                          {a.claim.memberName} — ₹{a.claim.claimAmount.toLocaleString("en-IN")}
                        </Link>
                        <span className="font-label-caps text-[10px] text-on-surface-variant">
                          {new Date(a.createdAt).toLocaleDateString("en-IN")}
                        </span>
                      </div>
                      <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
                        Original: {a.claim.decision?.decision}
                        {Array.isArray(a.claim.decision?.rejectionReasons) && a.claim.decision.rejectionReasons.length > 0
                          ? ` (${(a.claim.decision.rejectionReasons as string[]).map(rejectionCodeLabel).join(", ")})`
                          : ""}
                      </p>
                      <p className="font-body-sm text-body-sm text-on-surface mt-1">&ldquo;{a.reason}&rdquo;</p>
                      <ResolveForm appeal={a} onResolved={load} />
                    </div>
                  ))}
                </div>
              )}
            </section>

            {resolved.length > 0 && (
              <section>
                <h2 className="font-headline-sm text-headline-sm text-on-surface mb-stack-sm">Resolved</h2>
                <div className="flex flex-col gap-stack-sm">
                  {resolved.map((a) => (
                    <div key={a.id} className="p-padding-card border border-on-secondary-fixed/10 rounded-lg opacity-80">
                      <div className="flex justify-between items-baseline">
                        <Link href={`/claims/${a.claim.id}`} className="font-body-sm text-body-sm font-semibold text-primary hover:underline">
                          {a.claim.memberName}
                        </Link>
                        <span className="font-label-caps text-[10px] text-on-surface-variant">{a.status}</span>
                      </div>
                      {a.resolutionNote && (
                        <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">{a.resolutionNote}</p>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
