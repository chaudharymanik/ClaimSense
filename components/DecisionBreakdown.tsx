import { rejectionCodeLabel } from "@/lib/rejectionCodeLabels";

// Reuses the same 4 status colors as StatusPill.tsx — these are reserved status
// colors (good/critical/warning/neutral), always paired with a text label, never
// used as bare color-only identity, per the dataviz skill's status-palette rule.
const STATUS_BAR_COLOR: Record<string, string> = {
  APPROVED: "bg-[#137333]",
  REJECTED: "bg-error",
  PARTIAL: "bg-amber-500",
  MANUAL_REVIEW: "bg-outline",
};

const STATUS_LABEL: Record<string, string> = {
  APPROVED: "Approved",
  REJECTED: "Rejected",
  PARTIAL: "Partial",
  MANUAL_REVIEW: "Manual Review",
};

export interface StatusCounts {
  APPROVED: number;
  REJECTED: number;
  PARTIAL: number;
  MANUAL_REVIEW: number;
}

export interface RejectionReasonCount {
  code: string;
  count: number;
}

export default function DecisionBreakdown({
  statusCounts,
  topRejectionReasons,
}: {
  statusCounts: StatusCounts;
  topRejectionReasons: RejectionReasonCount[];
}) {
  const total = Object.values(statusCounts).reduce((a, b) => a + b, 0);
  const maxReasonCount = Math.max(1, ...topRejectionReasons.map((r) => r.count));

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-gutter-grid mb-stack-lg">
      <section className="bg-surface-container-lowest border border-on-secondary-fixed/10 rounded-lg p-padding-card">
        <h3 className="font-headline-sm text-headline-sm text-on-secondary-fixed mb-stack-md">Decision Breakdown</h3>
        {total === 0 ? (
          <p className="font-body-sm text-body-sm text-on-surface-variant">No decisions yet.</p>
        ) : (
          <div className="flex flex-col gap-unit">
            {(Object.keys(statusCounts) as (keyof StatusCounts)[]).map((status) => {
              const count = statusCounts[status];
              const pct = total > 0 ? Math.round((count / total) * 100) : 0;
              return (
                <div key={status} className="flex items-center gap-stack-sm">
                  <span className="font-label-caps text-label-caps text-on-surface-variant w-[110px] shrink-0">
                    {STATUS_LABEL[status]}
                  </span>
                  <div className="flex-1 bg-surface-container-high rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-2 rounded-full ${STATUS_BAR_COLOR[status]}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="font-data-mono text-data-mono text-on-surface w-[48px] text-right shrink-0">
                    {count}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="bg-surface-container-lowest border border-on-secondary-fixed/10 rounded-lg p-padding-card">
        <h3 className="font-headline-sm text-headline-sm text-on-secondary-fixed mb-stack-md">Top Rejection Reasons</h3>
        {topRejectionReasons.length === 0 ? (
          <p className="font-body-sm text-body-sm text-on-surface-variant">No rejections recorded yet.</p>
        ) : (
          <div className="flex flex-col gap-unit">
            {topRejectionReasons.map(({ code, count }) => (
              <div key={code} className="flex items-center gap-stack-sm">
                <span
                  title={code}
                  className="font-body-sm text-body-sm text-on-surface-variant w-[180px] shrink-0 truncate"
                >
                  {rejectionCodeLabel(code)}
                </span>
                <div className="flex-1 bg-surface-container-high rounded-full h-2 overflow-hidden">
                  <div
                    className="h-2 rounded-full bg-primary"
                    style={{ width: `${Math.round((count / maxReasonCount) * 100)}%` }}
                  />
                </div>
                <span className="font-data-mono text-data-mono text-on-surface w-[32px] text-right shrink-0">
                  {count}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
