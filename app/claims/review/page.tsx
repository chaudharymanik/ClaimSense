import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import TopNav from "@/components/TopNav";

export const dynamic = "force-dynamic";

function timeAgo(date: Date): string {
  const minutes = Math.round((Date.now() - date.getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

export default async function ManualReviewQueuePage() {
  const claims = await prisma.claim.findMany({
    where: { status: "MANUAL_REVIEW" },
    include: { decision: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="bg-background text-on-background font-body-md antialiased min-h-screen flex flex-col">
      <TopNav active="manual-queue" />
      <main className="flex-grow w-full max-w-[1440px] mx-auto px-margin-page py-margin-page">
        <header className="mb-stack-lg flex flex-col md:flex-row md:justify-between md:items-end gap-stack-md">
          <div>
            <p className="font-label-caps text-label-caps text-secondary tracking-widest mb-unit uppercase">
              Triage Pipeline
            </p>
            <h1 className="font-display-lg text-display-lg text-on-secondary-fixed">
              Needs a <em className="italic font-serif text-primary">human</em> look
            </h1>
          </div>
        </header>

        <section className="bg-surface-container-lowest rounded-xl border border-on-secondary-fixed/10 overflow-hidden shadow-sm">
          <div className="grid grid-cols-12 gap-unit px-padding-card py-stack-md border-b border-on-secondary-fixed/10 bg-surface-container-low/50">
            <div className="col-span-3 lg:col-span-2 font-label-caps text-label-caps text-on-surface-variant tracking-widest">
              Claim ID
            </div>
            <div className="col-span-4 lg:col-span-3 font-label-caps text-label-caps text-on-surface-variant tracking-widest">
              Member
            </div>
            <div className="col-span-5 lg:col-span-4 font-label-caps text-label-caps text-on-surface-variant tracking-widest">
              Flag Reason
            </div>
            <div className="hidden lg:block lg:col-span-2 font-label-caps text-label-caps text-on-surface-variant tracking-widest">
              Received
            </div>
            <div className="hidden lg:flex lg:col-span-1 justify-end font-label-caps text-label-caps text-on-surface-variant tracking-widest">
              Action
            </div>
          </div>

          <div className="flex flex-col">
            {claims.length === 0 && (
              <div className="px-padding-card py-10 text-center text-on-surface-variant font-body-sm text-body-sm">
                Nothing flagged for manual review right now.
              </div>
            )}
            {claims.map((claim) => {
              const flags = (claim.decision?.flags as string[] | null) ?? [];
              return (
                <Link
                  key={claim.id}
                  href={`/claims/${claim.id}`}
                  className="grid grid-cols-12 gap-unit px-padding-card py-stack-md border-b border-on-secondary-fixed/10 last:border-b-0 hover:bg-surface-bright transition-colors items-center group cursor-pointer"
                >
                  <div className="col-span-3 lg:col-span-2">
                    <span className="font-data-mono text-data-mono text-on-secondary-fixed">
                      #{claim.id.slice(-8).toUpperCase()}
                    </span>
                  </div>
                  <div className="col-span-4 lg:col-span-3">
                    <div className="font-body-md text-body-md text-on-secondary-fixed font-medium">
                      {claim.memberName}
                    </div>
                    <div className="font-body-sm text-body-sm text-secondary">ID: {claim.memberId}</div>
                  </div>
                  <div className="col-span-5 lg:col-span-4 flex flex-wrap gap-2 items-center">
                    {flags.length === 0 && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-tertiary-fixed text-on-surface-variant font-label-caps text-label-caps border border-tertiary-fixed-dim/50">
                        <span className="material-symbols-outlined text-[14px]">help</span>
                        Flagged for review
                      </span>
                    )}
                    {flags.map((flag, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-tertiary-fixed text-on-surface-variant font-label-caps text-label-caps border border-tertiary-fixed-dim/50"
                      >
                        <span className="material-symbols-outlined text-[14px]">warning</span>
                        {flag}
                      </span>
                    ))}
                  </div>
                  <div className="hidden lg:flex lg:col-span-2 items-center font-body-sm text-body-sm text-secondary">
                    {timeAgo(claim.createdAt)}
                  </div>
                  <div className="hidden lg:flex lg:col-span-1 justify-end items-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-primary hover:text-primary-container p-1 rounded">
                      <span className="material-symbols-outlined">arrow_forward</span>
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        <div className="flex justify-between items-center mt-stack-md px-2">
          <span className="font-body-sm text-body-sm text-secondary">
            Showing {claims.length} of {claims.length} flagged claims
          </span>
        </div>
      </main>
    </div>
  );
}
