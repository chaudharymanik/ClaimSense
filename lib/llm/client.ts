import { GoogleGenAI } from "@google/genai";

// "gemini-flash-latest" currently resolves to gemini-3.6-flash, whose free
// tier is only 20 requests/day/project — easy to exhaust while testing.
// "gemini-flash-lite-latest" has a far more generous free daily quota and is
// more than capable for structured field extraction and short Q&A. Gemini's
// quota is tracked per-model-per-project, so this is also a completely
// separate quota bucket from whatever gemini-flash-latest already used today.
export const MODEL = process.env.GEMINI_MODEL ?? "gemini-flash-lite-latest";
export const DEFAULT_TIMEOUT_MS = 20_000;

export function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set");
  }
  return new GoogleGenAI({ apiKey });
}

export function withTimeout<T>(promise: Promise<T>, ms: number = DEFAULT_TIMEOUT_MS): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`Gemini call timed out after ${ms}ms`)), ms)),
  ]);
}
