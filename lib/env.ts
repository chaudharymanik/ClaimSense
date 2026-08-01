const REQUIRED_ENV_VARS = ["DATABASE_URL", "DIRECT_URL", "GEMINI_API_KEY", "AUTH_SEED"] as const;

/**
 * Called once from instrumentation.ts's register() hook, which Next.js runs
 * before the server accepts any requests. Failing loudly here — a clear,
 * actionable error naming exactly which variable is missing — beats letting
 * the app boot successfully and then surface a confusing Prisma/Gemini SDK
 * stack trace on whichever request happens to touch the missing config first.
 */
export function validateEnv(): void {
  const missing = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variable(s): ${missing.join(", ")}. ` +
        `Set them in the deployment environment before starting the app — see .env.example for what each one is.`,
    );
  }
}
