import AdminLoginForm from "@/components/AdminLoginForm";

export const dynamic = "force-dynamic";

export default function AdminLoginPage() {
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
              <span className="italic font-display-lg text-brand-coral">Admin</span> Area
            </h2>
            <p className="font-body-sm text-body-sm text-on-secondary-fixed-variant opacity-70">
              Policy configuration and appeal resolution.
            </p>
          </div>

          <AdminLoginForm />
        </div>

        <p className="mt-stack-md text-center font-label-caps text-[10px] text-brand-cream/30 uppercase tracking-[0.3em]">
          © 2026 ClaimSense AI Adjudication.
        </p>
      </main>
    </div>
  );
}
