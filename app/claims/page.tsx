import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import StatusPill from "@/components/StatusPill";
import DecisionBreakdown, { type StatusCounts } from "@/components/DecisionBreakdown";

export const dynamic = "force-dynamic";

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" });
}

export default async function ClaimsOverviewPage() {
  // eslint-disable-next-line react-hooks/purity -- server component, needs the real current time per request, not a memoized render value
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [claims, totalCount, approvedThisWeekCount, pendingReviewCount, allDecisions] = await Promise.all([
    // Table only ever renders id/memberName/createdAt/claimAmount/status — no
    // documentText, no decision detail. See docs/DATA_FLOW_AUDIT.md.
    prisma.claim.findMany({
      orderBy: { createdAt: "desc" },
      take: 25,
      select: { id: true, memberName: true, createdAt: true, claimAmount: true, status: true },
    }),
    prisma.claim.count(),
    prisma.claim.count({
      where: { status: "APPROVED", createdAt: { gte: sevenDaysAgo } },
    }),
    prisma.claim.count({ where: { status: "MANUAL_REVIEW" } }),
    prisma.decision.findMany({ select: { decision: true, rejectionReasons: true } }),
  ]);

  // Evaluation-metrics bonus: decision breakdown + most common rejection
  // reasons, computed from real stored decisions (not a mock/placeholder).
  const statusCounts: StatusCounts = { APPROVED: 0, REJECTED: 0, PARTIAL: 0, MANUAL_REVIEW: 0 };
  const rejectionTally = new Map<string, number>();
  for (const d of allDecisions) {
    if (d.decision in statusCounts) statusCounts[d.decision as keyof StatusCounts]++;
    for (const code of (d.rejectionReasons as string[] | null) ?? []) {
      rejectionTally.set(code, (rejectionTally.get(code) ?? 0) + 1);
    }
  }
  const topRejectionReasons = [...rejectionTally.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([code, count]) => ({ code, count }));

  return (
    <div className="min-h-screen w-full flex font-body-md text-body-md text-on-background bg-background">
      {/* SideNavBar — Design/claims_dashboard/code.html */}
      <nav className="fixed left-0 top-0 h-full w-[280px] bg-surface-container-low border-r border-on-secondary-fixed/10 flex-col py-stack-lg z-20 hidden md:flex">
        <Link href="/claims" className="px-padding-card mb-stack-lg block hover:opacity-90 transition-opacity">
          <h2 className="font-display-md text-display-md text-on-secondary-fixed mb-1">ClaimSense</h2>
          <p className="font-body-sm text-body-sm text-on-surface-variant opacity-80">Insurance Intelligence</p>
        </Link>
        <div className="flex-1 px-stack-sm flex flex-col gap-unit">
          {/* "Claims" is the current page (this dashboard) — shown as the active
              item, not a link, since navigating to where you already are isn't
              useful. The Design mockup also had separate "Overview" and
              "Settings" items, but neither has a real page behind it in this
              build (no distinct overview view, no admin/settings feature was
              ever in scope) — removed rather than leaving dead nav entries,
              per user feedback that non-functional nav reads as unfinished. */}
          <span className="flex items-center gap-stack-md px-stack-md py-3 rounded-lg text-primary font-bold border-r-4 border-primary bg-primary/5 opacity-80 font-label-caps text-label-caps">
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
              description
            </span>
            <span>Claims</span>
          </span>
          <Link
            href="/claims/review"
            className="flex items-center gap-stack-md px-stack-md py-3 rounded-lg text-on-surface-variant hover:bg-surface-container-high transition-all font-label-caps text-label-caps"
          >
            <span className="material-symbols-outlined">assignment</span>
            <span>Queues</span>
          </Link>
        </div>
      </nav>

      <main className="flex-1 flex flex-col md:ml-[280px] min-h-screen">
        <header className="bg-on-secondary-fixed flex justify-between items-center w-full px-margin-page h-16 sticky top-0 z-10">
          <div className="flex items-center gap-stack-lg h-full pt-1">
            <span className="font-label-caps text-label-caps tracking-widest text-surface-bright border-b-2 border-primary pb-1 h-full flex items-center uppercase">
              Dashboard
            </span>
            <Link
              href="/claims/new"
              className="font-label-caps text-label-caps tracking-widest text-on-secondary-fixed-variant hover:text-primary transition-colors duration-200 h-full flex items-center uppercase"
            >
              New Claim
            </Link>
            <Link
              href="/claims/review"
              className="font-label-caps text-label-caps tracking-widest text-on-secondary-fixed-variant hover:text-primary transition-colors duration-200 h-full flex items-center uppercase"
            >
              Manual Queue
            </Link>
          </div>
          <Link
            href="/claims/new"
            className="bg-primary text-on-primary font-label-caps text-label-caps px-6 py-2 rounded-lg hover:bg-primary/90 transition-colors shadow-sm flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            New Claim
          </Link>
        </header>

        <div className="p-margin-page max-w-[1440px] mx-auto w-full">
          <div className="mb-stack-lg">
            <h1 className="font-display-lg text-display-lg text-on-secondary-fixed">Claims Overview</h1>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter-grid mb-stack-lg">
            <StatCard label="Claims Processed" value={totalCount.toLocaleString("en-IN")} />
            <StatCard label="Approved This Week" value={approvedThisWeekCount.toLocaleString("en-IN")} />
            <StatCard
              label="Pending Manual Review"
              value={pendingReviewCount.toLocaleString("en-IN")}
              accent={pendingReviewCount > 0}
            />
          </div>

          <DecisionBreakdown statusCounts={statusCounts} topRejectionReasons={topRejectionReasons} />

          <div className="bg-surface-container-lowest border border-on-secondary-fixed/10 rounded-lg shadow-[0_4px_20px_-10px_rgba(29,24,51,0.05)] flex flex-col">
            <div className="px-padding-card py-stack-md flex justify-between items-center border-b border-on-secondary-fixed/10 rounded-t-lg">
              <h3 className="font-headline-sm text-headline-sm text-on-secondary-fixed">Recent Submissions</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-container-low border-b border-on-secondary-fixed/10">
                    <th className="py-3 px-padding-card font-label-caps text-label-caps text-on-secondary-fixed-variant uppercase tracking-widest whitespace-nowrap">
                      Claim ID
                    </th>
                    <th className="py-3 px-stack-md font-label-caps text-label-caps text-on-secondary-fixed-variant uppercase tracking-widest whitespace-nowrap">
                      Member Name
                    </th>
                    <th className="py-3 px-stack-md font-label-caps text-label-caps text-on-secondary-fixed-variant uppercase tracking-widest whitespace-nowrap">
                      Date Submitted
                    </th>
                    <th className="py-3 px-stack-md font-label-caps text-label-caps text-on-secondary-fixed-variant uppercase tracking-widest whitespace-nowrap text-right">
                      Amount
                    </th>
                    <th className="py-3 px-padding-card font-label-caps text-label-caps text-on-secondary-fixed-variant uppercase tracking-widest whitespace-nowrap text-center">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="font-body-sm text-body-sm text-on-background">
                  {claims.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-10 px-padding-card text-center text-on-surface-variant">
                        No claims submitted yet. <Link href="/claims/new" className="text-primary underline">Submit the first one</Link>.
                      </td>
                    </tr>
                  )}
                  {claims.map((claim) => (
                    <tr
                      key={claim.id}
                      className="border-b border-on-secondary-fixed/10 last:border-b-0 hover:bg-surface-container-low/50 transition-colors group"
                    >
                      <td className="py-4 px-padding-card font-data-mono text-data-mono text-tertiary">
                        <Link href={`/claims/${claim.id}`} className="hover:text-primary">
                          #{claim.id.slice(-8).toUpperCase()}
                        </Link>
                      </td>
                      <td className="py-4 px-stack-md font-medium text-on-secondary-fixed flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-surface-variant flex items-center justify-center text-on-surface-variant font-label-caps text-label-caps">
                          {initials(claim.memberName)}
                        </div>
                        {claim.memberName}
                      </td>
                      <td className="py-4 px-stack-md text-on-surface-variant">{formatDate(claim.createdAt)}</td>
                      <td className="py-4 px-stack-md text-right font-data-mono text-data-mono font-medium">
                        ₹{claim.claimAmount.toLocaleString("en-IN")}
                      </td>
                      <td className="py-4 px-padding-card text-center">
                        <StatusPill status={claim.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="h-16" />
        </div>
      </main>
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div
      className={`bg-surface-container-lowest border border-on-secondary-fixed/10 rounded-lg p-padding-card flex flex-col justify-between h-[140px] shadow-[0_4px_20px_-10px_rgba(29,24,51,0.05)] hover:border-primary/30 transition-colors relative overflow-hidden ${accent ? "border-l-4 border-l-outline-variant" : ""}`}
    >
      <div className="absolute -right-4 -top-4 w-24 h-24 bg-surface-container-low rounded-full opacity-50 pointer-events-none" />
      <span className="font-label-caps text-label-caps text-tertiary-container uppercase tracking-wider">{label}</span>
      <div className="flex items-baseline gap-2">
        <span className="font-display-md text-display-md text-on-secondary-fixed font-bold">{value}</span>
        {accent && (
          <span className="font-body-sm text-body-sm text-primary flex items-center">
            <span className="material-symbols-outlined text-[16px]">warning</span> Action Req
          </span>
        )}
      </div>
    </div>
  );
}
