import { getClient, withTimeout, MODEL, FALLBACK_MODEL } from "./client";
import { redactSecrets } from "@/lib/redact";
import type { Decision } from "@/lib/types";

export type ExplainResult = { success: true; answer: string } | { success: false; reason: string };

const MAX_QUESTION_LENGTH = 500;

/**
 * "Ask about this decision" — a small, tightly-scoped Q&A grounded in one
 * claim's already-finalized decision. This is explanation only: the prompt
 * forbids the model from claiming it can change anything, and nothing here
 * writes back to the database or feeds into adjudicate(). Single-turn by
 * design (no chat history) — this is a bonus transparency feature, not a
 * general-purpose assistant, so it stays intentionally small in scope.
 */
export async function explainDecision(
  context: { memberName: string; claimAmount: number; decision: Decision },
  question: string,
): Promise<ExplainResult> {
  const trimmed = question.trim();
  if (!trimmed) {
    return { success: false, reason: "Question is empty." };
  }
  if (trimmed.length > MAX_QUESTION_LENGTH) {
    return { success: false, reason: `Question is too long (max ${MAX_QUESTION_LENGTH} characters).` };
  }

  const prompt = `You are explaining an already-finalized OPD insurance claim decision to whoever is asking (could be the claimant or a claims analyst). You are NOT deciding or re-deciding anything — the decision below is final and outside your control. Answer only using the context provided. If the question isn't about this claim/decision, politely say you can only discuss this specific claim. Keep the answer to 2-4 sentences, plain language, no markdown.

Claim context (JSON):
${JSON.stringify({ memberName: context.memberName, claimAmount: context.claimAmount, decision: context.decision.decision, approvedAmount: context.decision.approved_amount, rejectionReasons: context.decision.rejection_reasons, rejectedItems: context.decision.rejected_items, flags: context.decision.flags, confidence: context.decision.confidence_score, notes: context.decision.notes, nextSteps: context.decision.next_steps, ruleTrail: context.decision.trail })}

Question: ${trimmed}`;

  const primary = await askOnce(prompt, MODEL);
  if (primary.success) return primary;
  return askOnce(prompt, FALLBACK_MODEL);
}

/** One attempt against a specific model. Never throws — always resolves to a result. */
async function askOnce(prompt: string, model: string): Promise<ExplainResult> {
  try {
    const ai = getClient();
    const response = await withTimeout(
      ai.models.generateContent({
        model,
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: { temperature: 0.2 },
      }),
    );
    const answer = response.text?.trim();
    if (!answer) {
      return { success: false, reason: "No answer generated." };
    }
    return { success: true, answer };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, reason: redactSecrets(`explain_failed: ${message}`) };
  }
}
