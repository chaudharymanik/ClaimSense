const SECRET_ENV_VARS = ["GEMINI_API_KEY", "DATABASE_URL", "DIRECT_URL", "AUTH_SEED", "ADMIN_PASSWORD"] as const;

/**
 * Strips any live secret value out of a string before it can reach a user —
 * stored in the database, returned from an API route, or displayed in the
 * UI. Defense in depth: nothing observed from the Gemini SDK or Prisma today
 * echoes these values back in error messages, but error-message content
 * from a third-party SDK isn't a documented contract, and this project's
 * error messages ARE shown to end users by design (e.g. a failed
 * extraction's reason becomes the claim's visible `notes`, per Rules.md's
 * "never crash, explain why" requirement) — so this guard costs nothing and
 * removes the risk entirely rather than trusting an assumption about SDK
 * behavior.
 */
export function redactSecrets(text: string): string {
  let result = text;
  for (const key of SECRET_ENV_VARS) {
    const value = process.env[key];
    if (value && value.length > 0) {
      result = result.split(value).join(`[REDACTED:${key}]`);
    }
  }
  return result;
}
