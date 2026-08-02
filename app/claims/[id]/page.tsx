import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import TopNav from "@/components/TopNav";
import StatusPill from "@/components/StatusPill";
import AskAboutDecision from "@/components/AskAboutDecision";
import AppealSection from "@/components/AppealSection";
import { rejectionCodeLabel } from "@/lib/rejectionCodeLabels";
import type { RuleTrailItem } from "@/lib/types";

const APPEALABLE_STATUSES = ["REJECTED", "PARTIAL"] as const;

export const dynamic = "force-dynamic";

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" });
}

export default async function ClaimDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const claim = await prisma.claim.findUnique({
    where: { id },
    include: { extractedData: true, decision: true, appeal: true },
  });

  if (!claim) notFound();

  const decision = claim.decision;
  const trail = (decision?.ruleTrail as unknown as RuleTrailItem[] | undefined) ?? [];
  const confidencePct = decision ? Math.round(decision.confidenceScore * 100) : null;
  // The effective status can differ from the original decision.decision
  // after an appeal overturns it — claim.status is the one that's kept in
  // sync, decision.decision stays the original engine output forever.
  const appealable = APPEALABLE_STATUSES.includes(claim.status as (typeof APPEALABLE_STATUSES)[number]) && !claim.appeal;

  return (
    <div className="font-body-md text-on-surface flex flex-col min-h-screen bg-surface-bright">
      <TopNav active="dashboard" />
      <main className="flex-grow w-full max-w-[1440px] mx-auto px-margin-page py-stack-lg flex flex-col gap-stack-lg">
        <header className="flex items-center gap-stack-md flex-wrap">
          <h1 className="font-display-lg text-display-lg text-on-surface">
            Claim #{claim.id.slice(-8).toUpperCase()}
          </h1>
          <StatusPill status={claim.status} />
        </header>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-gutter-grid">
          <div className="md:col-span-4 flex flex-col gap-stack-md">
            <section className="card-surface p-padding-card flex flex-col gap-stack-md">
              <h2 className="font-headline-sm text-headline-sm text-on-surface border-b hairline-divider pb-unit">
                Claim Data
              </h2>
              <div className="flex flex-col gap-unit">
                <DataRow label="Member" value={claim.memberName} />
                <DataRow label="Member ID" value={claim.memberId} mono />
                <DataRow label="Date" value={formatDate(claim.treatmentDate)} />
                <DataRow label="Amount" value={`₹${claim.claimAmount.toLocaleString("en-IN")}`} mono last />
                {claim.hospital && <DataRow label="Hospital" value={claim.hospital} />}
                {claim.extractedData?.diagnosis && <DataRow label="Diagnosis" value={claim.extractedData.diagnosis} last />}
              </div>
            </section>

            {decision && (
              <section className="card-surface p-padding-card flex flex-col gap-unit">
                <div className="flex justify-between items-center">
                  <span className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-widest">
                    AI Confidence
                  </span>
                  <span className="font-data-mono text-data-mono text-primary font-bold">{confidencePct}%</span>
                </div>
                <div className="w-full bg-surface-container-high rounded-full h-1.5 overflow-hidden">
                  <div className="bg-primary h-1.5 rounded-full" style={{ width: `${confidencePct}%` }} />
                </div>
              </section>
            )}

            {claim.extractedData && (
              <section className="card-surface p-padding-card flex flex-col gap-unit">
                <h2 className="font-headline-sm text-headline-sm text-on-surface border-b hairline-divider pb-unit mb-unit">
                  Extracted Fields
                </h2>
                {claim.extractedData.doctorName && <DataRow label="Doctor" value={claim.extractedData.doctorName} />}
                {claim.extractedData.doctorReg && <DataRow label="Reg. No" value={claim.extractedData.doctorReg} mono />}
                {Array.isArray(claim.extractedData.medicinesPrescribed) &&
                  claim.extractedData.medicinesPrescribed.length > 0 && (
                    <div className="py-unit border-b hairline-divider">
                      <span className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-widest block mb-1">
                        Medicines
                      </span>
                      <span className="font-body-sm text-body-sm text-on-surface">
                        {(claim.extractedData.medicinesPrescribed as string[]).join(", ")}
                      </span>
                    </div>
                  )}
              </section>
            )}
          </div>

          <div className="md:col-span-8">
            <section className="card-surface p-padding-card h-full flex flex-col gap-stack-md">
              <h2 className="font-headline-sm text-headline-sm text-on-surface border-b hairline-divider pb-unit">
                Adjudication Trail
              </h2>
              {trail.length === 0 ? (
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  This claim is still processing.
                </p>
              ) : (
                <ul className="flex flex-col gap-unit flex-grow">
                  {trail.map((item, i) => (
                    <li
                      key={i}
                      className={`flex items-start gap-stack-sm py-unit ${i < trail.length - 1 ? "border-b hairline-divider" : ""}`}
                    >
                      <span
                        className={`material-symbols-outlined mt-0.5 ${item.passed ? "text-[#137333]" : "text-primary"}`}
                      >
                        {item.passed ? "check_circle" : "cancel"}
                      </span>
                      <div className="flex flex-col">
                        <span className="font-body-md text-body-md text-on-surface font-semibold">{item.step}</span>
                        <span className="font-body-sm text-body-sm text-on-surface-variant">{item.message}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>

        {decision && <FinalDecisionSection decision={decision} claimId={claim.id} />}
        {decision && (
          <AppealSection
            claimId={claim.id}
            appealable={appealable}
            appeal={
              claim.appeal
                ? {
                    id: claim.appeal.id,
                    reason: claim.appeal.reason,
                    status: claim.appeal.status,
                    resolutionNote: claim.appeal.resolutionNote,
                    overrideAmount: claim.appeal.overrideAmount,
                    createdAt: claim.appeal.createdAt.toISOString(),
                  }
                : null
            }
          />
        )}
        {decision && <AskAboutDecision claimId={claim.id} />}
      </main>
    </div>
  );
}

function DataRow({ label, value, mono, last }: { label: string; value: string; mono?: boolean; last?: boolean }) {
  return (
    <div className={`flex justify-between items-baseline py-unit ${last ? "" : "border-b hairline-divider"} gap-stack-md`}>
      <span className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-widest shrink-0">
        {label}
      </span>
      <span className={`text-right ${mono ? "font-data-mono text-data-mono" : "font-body-md text-body-md"} text-on-surface`}>
        {value}
      </span>
    </div>
  );
}

type DecisionRow = NonNullable<Awaited<ReturnType<typeof prisma.decision.findUnique>>>;

function FinalDecisionSection({ decision, claimId }: { decision: DecisionRow; claimId: string }) {
  const rejectionReasons = (decision.rejectionReasons as string[] | null) ?? [];
  const rejectedItems = (decision.rejectedItems as string[] | null) ?? [];
  const flags = (decision.flags as string[] | null) ?? [];

  return (
    <section className="card-surface p-padding-card flex flex-col gap-stack-md border-t-4 border-primary">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-stack-md">
        <div className="flex flex-col gap-1">
          <span className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-widest">
            Final Decision
          </span>
          {decision.decision === "APPROVED" && (
            <span className="font-display-lg text-display-lg text-on-surface">
              Approved Amount:{" "}
              <span className="font-data-mono">₹{decision.approvedAmount?.toLocaleString("en-IN")}</span>
            </span>
          )}
          {decision.decision === "PARTIAL" && (
            <span className="font-display-lg text-display-lg text-on-surface">
              Partially Approved:{" "}
              <span className="font-data-mono">₹{decision.approvedAmount?.toLocaleString("en-IN")}</span>
            </span>
          )}
          {decision.decision === "REJECTED" && (
            <span className="font-display-lg text-display-lg text-on-surface">Claim Rejected</span>
          )}
          {decision.decision === "MANUAL_REVIEW" && (
            <span className="font-display-lg text-display-lg text-on-surface">Pending Manual Review</span>
          )}
        </div>
        <Link
          href="/claims"
          className="px-6 py-2 border border-on-secondary-fixed/15 text-on-secondary-fixed font-label-caps text-label-caps rounded bg-transparent hover:bg-surface-container-low transition-colors shrink-0"
        >
          Back to Claims
        </Link>
      </div>

      {rejectionReasons.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {rejectionReasons.map((code) => (
            <span
              key={code}
              title={code}
              className="font-label-caps text-label-caps bg-error-container text-on-error-container px-2.5 py-1 rounded-full"
            >
              {rejectionCodeLabel(code)}
            </span>
          ))}
        </div>
      )}

      {rejectedItems.length > 0 && (
        <ul className="list-disc list-inside font-body-sm text-body-sm text-on-surface-variant">
          {rejectedItems.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      )}

      {flags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {flags.map((flag, i) => (
            <span
              key={i}
              className="font-label-caps text-label-caps bg-outline-variant text-on-surface-variant px-2.5 py-1 rounded-full"
            >
              {flag}
            </span>
          ))}
        </div>
      )}

      {decision.notes && <p className="font-body-sm text-body-sm text-on-surface-variant">{decision.notes}</p>}
      {decision.nextSteps && (
        <p className="font-body-sm text-body-sm text-on-surface-variant italic">Next steps: {decision.nextSteps}</p>
      )}
      <p className="font-body-sm text-body-sm text-on-surface-variant/60 text-xs">Claim ID: {claimId}</p>
    </section>
  );
}
