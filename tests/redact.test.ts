import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { redactSecrets } from "@/lib/redact";

describe("redactSecrets", () => {
  const original = { ...process.env };

  beforeEach(() => {
    process.env.GEMINI_API_KEY = "sk-fake-secret-value";
    process.env.DATABASE_URL = "postgresql://user:hunter2@host:5432/db";
  });

  afterEach(() => {
    process.env = { ...original };
  });

  it("removes a live secret value from a string", () => {
    const result = redactSecrets("call failed: sk-fake-secret-value is invalid");
    expect(result).not.toContain("sk-fake-secret-value");
    expect(result).toContain("[REDACTED:GEMINI_API_KEY]");
  });

  it("redacts multiple different secrets in the same string", () => {
    const result = redactSecrets("db postgresql://user:hunter2@host:5432/db and key sk-fake-secret-value both failed");
    expect(result).not.toContain("hunter2");
    expect(result).not.toContain("sk-fake-secret-value");
  });

  it("leaves ordinary text untouched", () => {
    const result = redactSecrets("extraction_failed: quota exceeded, please retry in 17s");
    expect(result).toBe("extraction_failed: quota exceeded, please retry in 17s");
  });
});
