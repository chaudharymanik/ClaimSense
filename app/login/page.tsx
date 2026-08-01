import LoginForm from "@/components/LoginForm";
import { todaysDemoPassword } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  // Server Component so AUTH_SEED itself never reaches the browser — only
  // this derived, intentionally-public daily code does. See lib/auth.ts.
  const demoPassword = todaysDemoPassword();

  return (
    <div className="h-screen w-screen bg-brand-navy overflow-hidden flex items-center justify-center py-10">
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-tr from-brand-navy via-transparent to-brand-navy/50 opacity-80" />
      </div>

      <main className="relative z-10 w-full max-w-[480px] px-margin-page">
        <div className="mb-stack-md text-center">
          <h1 className="font-display-md text-display-md text-brand-cream tracking-tight mb-2">ClaimSense</h1>
          <div className="h-[1px] w-12 bg-brand-coral/40 mx-auto" />
        </div>

        <div className="bg-brand-cream rounded-xl shadow-2xl p-padding-card flex flex-col gap-stack-md border border-brand-navy/5">
          <div className="space-y-2">
            <h2 className="font-headline-sm text-headline-sm text-on-secondary-fixed">
              Welcome to <span className="italic font-display-lg text-brand-coral">ClaimSense</span>
            </h2>
            <p className="font-body-sm text-body-sm text-on-secondary-fixed-variant opacity-70">
              Access your insurance intelligence dashboard.
            </p>
          </div>

          <div className="rounded-lg bg-brand-navy/5 border border-brand-navy/10 px-4 py-3">
            <p className="font-label-caps text-label-caps text-on-secondary-fixed-variant/70 uppercase tracking-widest mb-1">
              Demo Access
            </p>
            <p className="font-data-mono text-data-mono text-on-secondary-fixed">
              demo · {demoPassword}
            </p>
            <p className="font-body-sm text-[11px] text-on-secondary-fixed-variant/60 mt-0.5">
              Rotates daily at midnight UTC — this code is today&apos;s.
            </p>
          </div>

          <LoginForm />
        </div>

        <p className="mt-stack-md text-center font-label-caps text-[10px] text-brand-cream/30 uppercase tracking-[0.3em]">
          © 2026 ClaimSense AI Adjudication.
        </p>
      </main>
    </div>
  );
}
