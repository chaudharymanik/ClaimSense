"use client";

import { useState } from "react";

export default function AskAboutDecision({ claimId }: { claimId: string }) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleAsk(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim()) return;
    setLoading(true);
    setError(null);
    setAnswer(null);
    try {
      const res = await fetch(`/api/claims/${claimId}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't get an answer");
      setAnswer(data.answer);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="card-surface p-padding-card flex flex-col gap-stack-sm">
      <h2 className="font-headline-sm text-headline-sm text-on-surface border-b hairline-divider pb-unit flex items-center gap-2">
        <span className="material-symbols-outlined text-primary text-[20px]">forum</span>
        Ask about this decision
      </h2>
      <form onSubmit={handleAsk} className="flex gap-2">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="e.g. Why wasn't the full amount approved?"
          maxLength={500}
          className="flex-1 border border-on-secondary-fixed/15 rounded-lg px-3 py-2 font-body-sm text-body-sm text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 bg-surface-container-lowest transition-all"
        />
        <button
          type="submit"
          disabled={loading || !question.trim()}
          className="bg-primary text-on-primary font-label-caps text-label-caps px-4 py-2 rounded-lg hover:bg-primary-container transition-colors disabled:opacity-50 shrink-0"
        >
          {loading ? "Asking…" : "Ask"}
        </button>
      </form>
      {error && <p className="font-body-sm text-body-sm text-error">{error}</p>}
      {answer && (
        <p className="font-body-sm text-body-sm text-on-surface-variant bg-surface-container-low rounded-lg px-3 py-2">
          {answer}
        </p>
      )}
      <p className="font-body-sm text-body-sm text-on-surface-variant/60 text-xs">
        AI-generated explanation of the decision above — it can&apos;t change the outcome.
      </p>
    </section>
  );
}
