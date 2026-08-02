import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import AdminLogoutButton from "@/components/AdminLogoutButton";

export const dynamic = "force-dynamic";

export default async function AdminHomePage() {
  const pendingAppeals = await prisma.appeal.count({ where: { status: "PENDING" } });

  return (
    <div className="bg-surface font-body-md text-on-surface antialiased min-h-screen">
      <header className="bg-on-secondary-fixed min-h-16 flex flex-wrap items-center justify-between gap-2 px-margin-page py-3">
        <span className="font-display-md text-display-md text-surface-bright">ClaimSense Admin</span>
        <AdminLogoutButton className="font-label-caps text-label-caps text-surface-bright/70 hover:text-surface-bright transition-colors" />
      </header>
      <main className="max-w-2xl mx-auto px-margin-page py-stack-lg flex flex-col gap-stack-md">
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          Actions here take effect immediately for every claim submitted afterward, and — for appeal
          resolutions — for the specific claim being resolved. Both require this separate admin credential
          on top of the regular demo login.
        </p>

        <Link
          href="/admin/appeals"
          className="card-surface p-padding-card flex items-center justify-between hover:border-primary/30 transition-colors border border-on-secondary-fixed/10 rounded-lg"
        >
          <div>
            <h2 className="font-headline-sm text-headline-sm text-on-surface">Appeals</h2>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Review and resolve claimant appeals on rejected or partial decisions.
            </p>
          </div>
          {pendingAppeals > 0 && (
            <span className="font-label-caps text-label-caps bg-primary text-on-primary px-2.5 py-1 rounded-full shrink-0">
              {pendingAppeals} pending
            </span>
          )}
        </Link>

        <Link
          href="/admin/policy"
          className="card-surface p-padding-card flex items-center justify-between hover:border-primary/30 transition-colors border border-on-secondary-fixed/10 rounded-lg"
        >
          <div>
            <h2 className="font-headline-sm text-headline-sm text-on-surface">Policy Configuration</h2>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Edit coverage limits, copay/discount rates, exclusions, and network hospitals.
            </p>
          </div>
        </Link>

        <Link href="/claims" className="font-body-sm text-body-sm text-primary hover:underline mt-stack-sm">
          ← Back to the main dashboard
        </Link>
      </main>
    </div>
  );
}
