import type { DecisionType } from "@/lib/types";

// Colors reconciled from the Design/ mockups' actual rendered screenshots
// (source of truth) where they disagreed with DESIGN.md's prose or with each
// other: claim_detail_view's page-level badge renders APPROVED in green and
// that's what DESIGN.md's component spec calls for too, so green wins over
// the claims_dashboard table's inconsistent neutral-tan treatment of the
// same status. MANUAL_REVIEW is dusty rose in the actual dashboard mockup
// (bg-outline-variant), not the amber DESIGN.md's prose describes. PARTIAL
// isn't covered by any mockup — amber fills that gap so all five statuses
// stay visually distinct.
const STATUS_STYLES: Record<DecisionType | "PROCESSING", string> = {
  APPROVED: "bg-[#e6f4ea] text-[#137333] border border-[#137333]/20",
  REJECTED: "bg-error-container text-on-error-container border border-outline-variant",
  MANUAL_REVIEW: "bg-outline-variant text-on-surface-variant border border-outline-variant/30",
  PARTIAL: "bg-amber-100 text-amber-800 border border-amber-300",
  PROCESSING: "bg-secondary-container text-on-secondary-container border border-secondary-fixed-dim",
};

const STATUS_LABELS: Record<DecisionType | "PROCESSING", string> = {
  APPROVED: "Approved",
  REJECTED: "Rejected",
  MANUAL_REVIEW: "Manual Review",
  PARTIAL: "Partial",
  PROCESSING: "Processing",
};

export default function StatusPill({ status }: { status: DecisionType | "PROCESSING" }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full font-label-caps text-[10px] ${STATUS_STYLES[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
