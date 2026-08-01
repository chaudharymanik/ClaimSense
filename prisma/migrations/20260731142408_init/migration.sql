-- CreateEnum
CREATE TYPE "ClaimStatus" AS ENUM ('PROCESSING', 'APPROVED', 'REJECTED', 'PARTIAL', 'MANUAL_REVIEW');

-- CreateTable
CREATE TABLE "Claim" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "memberName" TEXT NOT NULL,
    "memberJoinDate" TIMESTAMP(3),
    "treatmentDate" TIMESTAMP(3) NOT NULL,
    "claimAmount" INTEGER NOT NULL,
    "hospital" TEXT,
    "cashlessRequest" BOOLEAN NOT NULL DEFAULT false,
    "documentText" TEXT,
    "documentFileUrl" TEXT,
    "status" "ClaimStatus" NOT NULL DEFAULT 'PROCESSING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Claim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExtractedData" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "doctorName" TEXT,
    "doctorReg" TEXT,
    "diagnosis" TEXT,
    "medicinesPrescribed" JSONB,
    "procedures" JSONB,
    "testsPrescribed" JSONB,
    "billedItems" JSONB,
    "extractionRaw" JSONB NOT NULL,
    "extractionConfidence" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExtractedData_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Decision" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "decision" "ClaimStatus" NOT NULL,
    "approvedAmount" INTEGER,
    "deductions" JSONB,
    "rejectionReasons" JSONB,
    "rejectedItems" JSONB,
    "flags" JSONB,
    "ruleTrail" JSONB NOT NULL,
    "confidenceScore" DOUBLE PRECISION NOT NULL,
    "notes" TEXT,
    "nextSteps" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Decision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Claim_memberId_idx" ON "Claim"("memberId");

-- CreateIndex
CREATE INDEX "Claim_status_idx" ON "Claim"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ExtractedData_claimId_key" ON "ExtractedData"("claimId");

-- CreateIndex
CREATE UNIQUE INDEX "Decision_claimId_key" ON "Decision"("claimId");

-- AddForeignKey
ALTER TABLE "ExtractedData" ADD CONSTRAINT "ExtractedData_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Decision" ADD CONSTRAINT "Decision_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE CASCADE ON UPDATE CASCADE;
