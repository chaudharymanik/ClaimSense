const BUCKET_LABEL: Record<string, string> = {
  high: "High (≥ 0.90)",
  good: "Good (0.70–0.89)",
  low: "Low (0.40–0.69)",
  illegible: "Illegible (< 0.40)",
};

const BUCKET_COLOR: Record<string, string> = {
  high: "bg-[#137333]",
  good: "bg-primary",
  low: "bg-amber-500",
  illegible: "bg-error",
};

export interface ExtractionAccuracyStats {
  totalExtractions: number;
  averageConfidence: number | null;
  distribution: { high: number; good: number; low: number; illegible: number };
  manualReviewForConfidence: number;
  extractionFailures: number;
  totalClaims: number;
}

export default function AiAccuracyMetrics({ stats }: { stats: ExtractionAccuracyStats }) {
  const { totalExtractions, averageConfidence, distribution, manualReviewForConfidence, extractionFailures, totalClaims } = stats;
  const maxBucket = Math.max(1, ...Object.values(distribution));

  return (
    <section className="bg-surface-container-lowest border border-on-secondary-fixed/10 rounded-lg p-padding-card mb-stack-lg">
      <div className="flex items-baseline justify-between mb-stack-md">
        <h3 className="font-headline-sm text-headline-sm text-on-secondary-fixed">AI Extraction Accuracy</h3>
        <span className="font-body-sm text-body-sm text-on-surface-variant">
          Self-reported confidence, not verified against ground truth
        </span>
      </div>

      {totalExtractions === 0 ? (
        <p className="font-body-sm text-body-sm text-on-surface-variant">No extractions recorded yet.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-gutter-grid">
          <div className="flex flex-col gap-stack-md">
            <div className="flex items-baseline gap-3">
              <span className="font-display-md text-display-md text-on-secondary-fixed font-bold">
                {Math.round((averageConfidence ?? 0) * 100)}%
              </span>
              <span className="font-body-sm text-body-sm text-on-surface-variant">
                average extraction confidence across {totalExtractions} document{totalExtractions === 1 ? "" : "s"}
              </span>
            </div>
            <div className="flex flex-col gap-unit">
              <div className="flex justify-between font-body-sm text-body-sm text-on-surface-variant">
                <span>Routed to manual review for low AI confidence</span>
                <span className="font-data-mono text-data-mono text-on-surface">
                  {manualReviewForConfidence} / {totalClaims}
                </span>
              </div>
              <div className="flex justify-between font-body-sm text-body-sm text-on-surface-variant">
                <span>Document extraction failed outright</span>
                <span className="font-data-mono text-data-mono text-on-surface">
                  {extractionFailures} / {totalClaims}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-unit">
            {(Object.keys(distribution) as (keyof typeof distribution)[]).map((bucket) => (
              <div key={bucket} className="flex items-center gap-stack-sm">
                <span className="font-label-caps text-label-caps text-on-surface-variant w-[150px] shrink-0">
                  {BUCKET_LABEL[bucket]}
                </span>
                <div className="flex-1 bg-surface-container-high rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-2 rounded-full ${BUCKET_COLOR[bucket]}`}
                    style={{ width: `${Math.round((distribution[bucket] / maxBucket) * 100)}%` }}
                  />
                </div>
                <span className="font-data-mono text-data-mono text-on-surface w-[32px] text-right shrink-0">
                  {distribution[bucket]}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
