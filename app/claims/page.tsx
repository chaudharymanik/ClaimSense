import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import StatusPill from "@/components/StatusPill";
import DecisionBreakdown, { type StatusCounts } from "@/components/DecisionBreakdown";
import AiAccuracyMetrics, { type ExtractionAccuracyStats } from "@/components/AiAccuracyMetrics";
import LogoutButton from "@/components/LogoutButton";

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
  const [claims, totalCount, approvedThisWeekCount, pendingReviewCount, allDecisions, extractions] = await Promise.all([
    // Table only ever renders id/memberName/createdAt/claimAmount/status — no
    // documentText, no decision detail (see docs/API.md's GET /api/claims section).
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
    prisma.decision.findMany({ select: { decision: true, rejectionReasons: true, flags: true } }),
    // AI accuracy metrics bonus: self-reported extraction confidence only —
    // no ground-truth comparison exists, and the UI says so rather than
    // implying more rigor than this actually is.
    prisma.extractedData.findMany({ select: { extractionConfidence: true } }),
  ]);

  // Evaluation-metrics bonus: decision breakdown + most common rejection
  // reasons, computed from real stored decisions (not a mock/placeholder).
  const statusCounts: StatusCounts = { APPROVED: 0, REJECTED: 0, PARTIAL: 0, MANUAL_REVIEW: 0 };
  const rejectionTally = new Map<string, number>();
  let manualReviewForConfidence = 0;
  let extractionFailures = 0;
  for (const d of allDecisions) {
    if (d.decision in statusCounts) statusCounts[d.decision as keyof StatusCounts]++;
    for (const code of (d.rejectionReasons as string[] | null) ?? []) {
      rejectionTally.set(code, (rejectionTally.get(code) ?? 0) + 1);
    }
    const flags = (d.flags as string[] | null) ?? [];
    if (flags.includes("Low confidence decision")) manualReviewForConfidence++;
    if (flags.includes("Document extraction failed")) extractionFailures++;
  }
  const topRejectionReasons = [...rejectionTally.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([code, count]) => ({ code, count }));

  const extractionAccuracy: ExtractionAccuracyStats = {
    totalExtractions: extractions.length,
    averageConfidence:
      extractions.length > 0
        ? extractions.reduce((sum, e) => sum + e.extractionConfidence, 0) / extractions.length
        : null,
    distribution: extractions.reduce(
      (acc, e) => {
        const c = e.extractionConfidence;
        if (c >= 0.9) acc.high++;
        else if (c >= 0.7) acc.good++;
        else if (c >= 0.4) acc.low++;
        else acc.illegible++;
        return acc;
      },
      { high: 0, good: 0, low: 0, illegible: 0 },
    ),
    manualReviewForConfidence,
    extractionFailures,
    totalClaims: totalCount,
  };

  return (
    <div className="min-h-screen w-full flex font-body-md text-body-md text-on-background bg-background">
      {/* Checkbox-hack mobile drawer toggle — no client JS needed. Must
          precede both the backdrop and the nav below (as a sibling) for
          peer-checked to reach them. Desktop (lg:, 1024px+) behavior is
          unchanged: always visible, checkbox state has no effect. Below
          lg — including tablet widths, where a 280px sidebar plus a
          3-column grid was too cramped — it collapses to this drawer. */}
      <input type="checkbox" id="sidenav-mobile-toggle" className="peer hidden" />
      <label
        htmlFor="sidenav-mobile-toggle"
        aria-label="Close navigation menu overlay"
        className="hidden peer-checked:block lg:hidden fixed inset-0 bg-black/40 z-10"
      />
      {/* SideNavBar — Design/claims_dashboard/code.html */}
      <nav className="fixed left-0 top-0 h-full w-[280px] bg-surface-container-low border-r border-on-secondary-fixed/10 flex-col py-stack-lg z-20 flex -translate-x-full peer-checked:translate-x-0 lg:translate-x-0 transition-transform duration-200">
        <div className="flex items-start justify-between px-padding-card mb-stack-lg">
          <Link href="/claims" className="block hover:opacity-90 transition-opacity">
            <h2 className="font-display-md text-display-md text-on-secondary-fixed mb-1">ClaimSense</h2>
            <p className="font-body-sm text-body-sm text-on-surface-variant opacity-80">Insurance Intelligence</p>
          </Link>
          <label
            htmlFor="sidenav-mobile-toggle"
            aria-label="Close navigation menu"
            className="lg:hidden cursor-pointer text-on-surface-variant flex items-center"
          >
            <span className="material-symbols-outlined">close</span>
          </label>
        </div>
        <div className="flex-1 px-stack-sm flex flex-col gap-unit">
          {/* "Claims" is the current page (this dashboard) — shown as the active
              item, not a link, since navigating to where you already are isn't
              useful. The Design mockup's "Overview" item still has no real page
              behind it — removed, per user feedback that non-functional nav
              reads as unfinished. "Settings" is now "Admin" below: a real admin
              area exists now (appeals + policy config), gated by its own
              separate credential, not the demo login. */}
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
          <Link
            href="/admin"
            className="flex items-center gap-stack-md px-stack-md py-3 rounded-lg text-on-surface-variant hover:bg-surface-container-high transition-all font-label-caps text-label-caps"
          >
            <span className="material-symbols-outlined">admin_panel_settings</span>
            <span>Admin</span>
          </Link>
        </div>
        <div className="px-stack-sm">
          <LogoutButton className="w-full flex items-center gap-stack-md px-stack-md py-3 rounded-lg text-on-surface-variant hover:bg-surface-container-high transition-all font-label-caps text-label-caps text-left">
            <span className="material-symbols-outlined">logout</span>
            <span>Logout</span>
          </LogoutButton>
        </div>
      </nav>

      <main className="flex-1 flex flex-col lg:ml-[280px] min-h-screen">
        <header className="bg-on-secondary-fixed flex justify-between items-center w-full px-margin-page h-16 sticky top-0 z-10">
          <div className="flex items-center gap-stack-lg h-full pt-1">
            <label
              htmlFor="sidenav-mobile-toggle"
              aria-label="Open navigation menu"
              className="lg:hidden cursor-pointer text-surface-bright flex items-center"
            >
              <span className="material-symbols-outlined">menu</span>
            </label>
            <span className="font-label-caps text-label-caps tracking-widest text-surface-bright border-b-2 border-primary pb-1 h-full flex items-center uppercase">
              Dashboard
            </span>
            <Link
              href="/claims/new"
              className="hidden lg:flex font-label-caps text-label-caps tracking-widest text-on-secondary-fixed-variant hover:text-primary transition-colors duration-200 h-full items-center uppercase"
            >
              New Claim
            </Link>
            <Link
              href="/claims/review"
              className="hidden lg:flex font-label-caps text-label-caps tracking-widest text-on-secondary-fixed-variant hover:text-primary transition-colors duration-200 h-full items-center uppercase"
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

          <AiAccuracyMetrics stats={extractionAccuracy} />

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
