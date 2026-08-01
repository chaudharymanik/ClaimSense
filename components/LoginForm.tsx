"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function Form() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Incorrect password.");
        setSubmitting(false);
        return;
      }
      const dest = searchParams.get("from") || "/claims";
      router.push(dest);
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-stack-md">
      <div className="space-y-1.5">
        <label
          htmlFor="username"
          className="font-label-caps text-label-caps text-on-secondary-fixed-variant uppercase tracking-widest"
        >
          Username
        </label>
        <input
          id="username"
          type="text"
          placeholder="demo"
          className="w-full h-12 px-4 rounded-lg bg-white border border-on-secondary-fixed-variant/10 font-body-md text-body-md text-on-surface focus:ring-2 focus:ring-brand-coral focus:border-transparent transition-all outline-none"
        />
      </div>
      <div className="space-y-1.5">
        <label
          htmlFor="password"
          className="font-label-caps text-label-caps text-on-secondary-fixed-variant uppercase tracking-widest"
        >
          Password
        </label>
        <div className="relative group">
          <input
            id="password"
            required
            autoFocus
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full h-12 px-4 rounded-lg bg-white border border-on-secondary-fixed-variant/10 font-body-md text-body-md text-on-surface focus:ring-2 focus:ring-brand-coral focus:border-transparent transition-all outline-none"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-on-secondary-fixed-variant/40 hover:text-brand-coral transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">
              {showPassword ? "visibility_off" : "visibility"}
            </span>
          </button>
        </div>
      </div>
      {error && (
        <p className="font-body-sm text-body-sm text-error bg-error-container rounded-lg px-3 py-2">{error}</p>
      )}
      <button
        type="submit"
        disabled={submitting || password.length === 0}
        className="mt-stack-sm h-14 bg-brand-coral text-white font-label-caps text-label-caps uppercase tracking-[0.2em] rounded-lg hover:bg-brand-coral/90 active:scale-[0.98] transition-all shadow-lg shadow-brand-coral/20 flex items-center justify-center gap-2 disabled:opacity-60"
      >
        {submitting ? "Checking…" : "Log In"}
        <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
      </button>
    </form>
  );
}

export default function LoginForm() {
  return (
    <Suspense>
      <Form />
    </Suspense>
  );
}
