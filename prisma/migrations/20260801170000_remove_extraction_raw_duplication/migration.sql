-- Drop extractionRaw: a duplicate JSON snapshot of doctorName/diagnosis/
-- medicines/etc. that were already stored as their own named columns in the
-- same row. Zero readers anywhere in the app. Removed as unnecessary
-- duplication of health-adjacent data during the pre-deployment data-flow
-- audit — see docs/DATA_FLOW_AUDIT.md.
ALTER TABLE "ExtractedData" DROP COLUMN "extractionRaw";
