import crypto from "crypto";

export const SESSION_COOKIE_NAME = "claimsense_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

export const ADMIN_SESSION_COOKIE_NAME = "claimsense_admin_session";
export const ADMIN_SESSION_MAX_AGE_SECONDS = 60 * 60 * 8; // 8 hours — shorter-lived than the demo session, since it grants a materially more consequential capability (editing policy, overriding decisions)

function seed(): string {
  const value = process.env.AUTH_SEED;
  if (!value) {
    throw new Error("AUTH_SEED is not set");
  }
  return value;
}

function hmac(label: string): string {
  return crypto.createHmac("sha256", seed()).update(label).digest("hex");
}

/**
 * Deliberately a SEPARATE secret from AUTH_SEED, not a rotating/derived
 * value — admin access (editing policy terms, overriding appeal decisions)
 * is meaningfully more consequential than the demo login, so it needs its
 * own credential that isn't shown anywhere and isn't guessable from
 * anything the demo-login layer exposes. Only the project owner should
 * ever know this value.
 */
function adminSecret(): string {
  const value = process.env.ADMIN_PASSWORD;
  if (!value) {
    throw new Error("ADMIN_PASSWORD is not set");
  }
  return value;
}

function utcDateString(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10); // "YYYY-MM-DD"
}

/**
 * The demo login password, shown openly on /login so any evaluator can
 * self-serve without needing the password emailed to them. Deterministic
 * from AUTH_SEED (never itself displayed) + the current UTC date — every
 * server instance computes the same value independently (required on
 * Vercel, where requests can land on different, memory-isolated instances),
 * and it rotates itself at midnight UTC with no code running and no
 * database involved. Truncated to 5 uppercase hex characters — this is a
 * demo-URL speed bump, not a real secret, so short and easy to type/read
 * off a screen matters more here than entropy.
 */
export function todaysDemoPassword(): string {
  return hmac(`demo-password:${utcDateString()}`).slice(0, 5).toUpperCase();
}

/**
 * The session cookie's value. Deliberately NOT date-dependent — unlike the
 * displayed password, this must stay valid for the cookie's full 7-day
 * lifetime even as the displayed password rotates underneath it daily.
 * Stateless for the same reason as todaysDemoPassword(): any server
 * instance can recompute and compare it without a shared session store.
 */
export function expectedSessionToken(): string {
  return hmac("session");
}

/**
 * Checks a submitted admin password against ADMIN_PASSWORD directly
 * (there's no "displayed daily code" concept here — this credential is
 * never shown anywhere, so a plain equality check is appropriate, unlike
 * the demo password which is intentionally public).
 */
export function isCorrectAdminPassword(candidate: string): boolean {
  return candidate === adminSecret();
}

/** Stateless for the same reason as expectedSessionToken() — no session store. */
export function expectedAdminSessionToken(): string {
  return crypto.createHash("sha256").update(adminSecret()).digest("hex");
}
