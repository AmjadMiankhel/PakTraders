-- CreateEnum
CREATE TYPE "SourceCategory" AS ENUM ('FEDERAL', 'PROVINCIAL', 'AJK', 'GILGIT_BALTISTAN', 'DEPARTMENT', 'HOSPITAL', 'UNIVERSITY', 'DEVELOPMENT_AUTHORITY', 'PUBLIC_SECTOR', 'NEWSPAPER', 'PRIVATE');

-- CreateEnum
CREATE TYPE "CollectionMethod" AS ENUM ('OFFICIAL_API', 'AUTHORIZED_FEED', 'RSS', 'WEBSITE_MONITOR', 'DATASET', 'EMAIL_FEED', 'PDF_AD', 'OCR', 'MANUAL_IMPORT');

-- CreateEnum
CREATE TYPE "SourceStatus" AS ENUM ('ACTIVE', 'PAUSED', 'DEGRADED', 'DISABLED', 'PENDING_REVIEW');

-- CreateEnum
CREATE TYPE "SourceRunStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'PARTIAL', 'FAILED', 'SKIPPED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SourceRunTrigger" AS ENUM ('SCHEDULE', 'MANUAL', 'RETRY', 'WEBHOOK');

-- CreateEnum
CREATE TYPE "IngestStatus" AS ENUM ('NEW', 'UPDATED', 'DUPLICATE', 'NEEDS_REVIEW', 'PUBLISHED', 'REJECTED', 'FAILED');

-- CreateEnum
CREATE TYPE "ExtractionFieldSource" AS ENUM ('SOURCE', 'AI', 'RULE', 'MANUAL');

-- CreateEnum
CREATE TYPE "DuplicateMatchType" AS ENUM ('EXACT_SOURCE_ID', 'EXACT_REFERENCE', 'EXACT_DOCUMENT', 'EXACT_URL', 'FUZZY');

-- CreateEnum
CREATE TYPE "DuplicateDecision" AS ENUM ('PENDING', 'MERGED', 'KEPT_SEPARATE', 'IGNORED');

-- CreateEnum
CREATE TYPE "OcrStatus" AS ENUM ('NOT_REQUIRED', 'PENDING', 'COMPLETED', 'FAILED', 'UNSUPPORTED');

-- DropIndex
DROP INDEX "tenders_description_trgm_idx";

-- DropIndex
DROP INDEX "tenders_reference_number_idx";

-- DropIndex
DROP INDEX "tenders_title_trgm_idx";

-- AlterTable
ALTER TABLE "tender_documents" ADD COLUMN     "extractionConfidence" DOUBLE PRECISION,
ADD COLUMN     "ocrUsed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "originalUrl" TEXT,
ADD COLUMN     "pageReferences" JSONB,
ADD COLUMN     "sha256" TEXT;

-- AlterTable
ALTER TABLE "tender_sources" ADD COLUMN     "accessNotes" TEXT,
ADD COLUMN     "autoPublish" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "baseUrl" TEXT,
ADD COLUMN     "category" "SourceCategory" NOT NULL DEFAULT 'FEDERAL',
ADD COLUMN     "code" TEXT,
ADD COLUMN     "collectionMethod" "CollectionMethod" NOT NULL DEFAULT 'MANUAL_IMPORT',
ADD COLUMN     "configJson" JSONB,
ADD COLUMN     "connectorKey" TEXT NOT NULL DEFAULT 'manual',
ADD COLUMN     "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "isEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lastError" TEXT,
ADD COLUMN     "lastRunAt" TIMESTAMP(3),
ADD COLUMN     "lastSuccessAt" TIMESTAMP(3),
ADD COLUMN     "maxPages" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "minConfidence" DOUBLE PRECISION NOT NULL DEFAULT 0.75,
ADD COLUMN     "nextRunAt" TIMESTAMP(3),
ADD COLUMN     "priority" INTEGER NOT NULL DEFAULT 50,
ADD COLUMN     "provinceId" UUID,
ADD COLUMN     "rateLimitPerMinute" INTEGER NOT NULL DEFAULT 6,
ADD COLUMN     "requiresAuth" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "respectRobots" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "scheduleMinutes" INTEGER NOT NULL DEFAULT 60,
ADD COLUMN     "status" "SourceStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
ADD COLUMN     "termsUrl" TEXT;

-- AlterTable
ALTER TABLE "tenders" ADD COLUMN     "extractionConfidence" DOUBLE PRECISION,
ADD COLUMN     "lastChangedAt" TIMESTAMP(3),
ADD COLUMN     "lastCheckedAt" TIMESTAMP(3),
ADD COLUMN     "needsReview" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "originalDocumentUrl" TEXT,
ADD COLUMN     "sourceContentHash" TEXT,
ADD COLUMN     "sourceExternalId" TEXT,
ADD COLUMN     "sourceMetadata" JSONB;

-- CreateTable
CREATE TABLE "source_runs" (
    "id" UUID NOT NULL,
    "sourceId" UUID NOT NULL,
    "jobId" TEXT,
    "status" "SourceRunStatus" NOT NULL DEFAULT 'QUEUED',
    "trigger" "SourceRunTrigger" NOT NULL DEFAULT 'SCHEDULE',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "itemsFound" INTEGER NOT NULL DEFAULT 0,
    "itemsNew" INTEGER NOT NULL DEFAULT 0,
    "itemsUpdated" INTEGER NOT NULL DEFAULT 0,
    "itemsDuplicate" INTEGER NOT NULL DEFAULT 0,
    "itemsReview" INTEGER NOT NULL DEFAULT 0,
    "itemsFailed" INTEGER NOT NULL DEFAULT 0,
    "documentsFetched" INTEGER NOT NULL DEFAULT 0,
    "bytesDownloaded" INTEGER NOT NULL DEFAULT 0,
    "errorSummary" TEXT,
    "logJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "source_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "source_documents" (
    "id" UUID NOT NULL,
    "sourceId" UUID NOT NULL,
    "runId" UUID,
    "tenderId" UUID,
    "url" TEXT NOT NULL,
    "finalUrl" TEXT,
    "fileName" TEXT,
    "mimeType" TEXT,
    "httpStatus" INTEGER,
    "contentLength" INTEGER,
    "sha256" TEXT,
    "storagePath" TEXT,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "textContent" TEXT,
    "textLanguage" TEXT,
    "pageCount" INTEGER,
    "ocrStatus" "OcrStatus" NOT NULL DEFAULT 'NOT_REQUIRED',
    "ocrConfidence" DOUBLE PRECISION,
    "extractionConfidence" DOUBLE PRECISION,
    "error" TEXT,

    CONSTRAINT "source_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tender_imports" (
    "id" UUID NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "sourceId" UUID NOT NULL,
    "runId" UUID,
    "externalId" TEXT,
    "sourceUrl" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "rawJson" JSONB NOT NULL,
    "normalizedJson" JSONB,
    "status" "IngestStatus" NOT NULL DEFAULT 'NEW',
    "confidence" DOUBLE PRECISION,
    "tenderId" UUID,
    "duplicateOfId" UUID,
    "duplicateScore" DOUBLE PRECISION,
    "duplicateSignals" JSONB,
    "reviewNotes" TEXT,
    "documentId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tender_imports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tender_provenance" (
    "id" UUID NOT NULL,
    "tenderId" UUID NOT NULL,
    "field" TEXT NOT NULL,
    "value" TEXT,
    "source" "ExtractionFieldSource" NOT NULL DEFAULT 'SOURCE',
    "confidence" DOUBLE PRECISION,
    "documentId" UUID,
    "page" INTEGER,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tender_provenance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tender_duplicate_reviews" (
    "id" UUID NOT NULL,
    "tenderId" UUID NOT NULL,
    "candidateId" UUID,
    "importId" UUID,
    "matchType" "DuplicateMatchType" NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "signalsJson" JSONB,
    "decision" "DuplicateDecision" NOT NULL DEFAULT 'PENDING',
    "mergedTenderId" UUID,
    "reviewedById" UUID,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tender_duplicate_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "source_runs_sourceId_startedAt_idx" ON "source_runs"("sourceId", "startedAt");

-- CreateIndex
CREATE INDEX "source_runs_status_startedAt_idx" ON "source_runs"("status", "startedAt");

-- CreateIndex
CREATE INDEX "source_documents_sourceId_fetchedAt_idx" ON "source_documents"("sourceId", "fetchedAt");

-- CreateIndex
CREATE INDEX "source_documents_sha256_idx" ON "source_documents"("sha256");

-- CreateIndex
CREATE INDEX "source_documents_tenderId_idx" ON "source_documents"("tenderId");

-- CreateIndex
CREATE UNIQUE INDEX "tender_imports_sourceKey_key" ON "tender_imports"("sourceKey");

-- CreateIndex
CREATE INDEX "tender_imports_status_createdAt_idx" ON "tender_imports"("status", "createdAt");

-- CreateIndex
CREATE INDEX "tender_imports_sourceId_externalId_idx" ON "tender_imports"("sourceId", "externalId");

-- CreateIndex
CREATE INDEX "tender_imports_tenderId_idx" ON "tender_imports"("tenderId");

-- CreateIndex
CREATE INDEX "tender_provenance_tenderId_field_idx" ON "tender_provenance"("tenderId", "field");

-- CreateIndex
CREATE INDEX "tender_duplicate_reviews_decision_createdAt_idx" ON "tender_duplicate_reviews"("decision", "createdAt");

-- CreateIndex
CREATE INDEX "tender_duplicate_reviews_tenderId_idx" ON "tender_duplicate_reviews"("tenderId");

-- Backfill source codes for existing rows before enforcing uniqueness.
UPDATE "tender_sources" SET "code" = "slug" WHERE "code" IS NULL;
ALTER TABLE "tender_sources" ALTER COLUMN "code" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "tender_sources_code_key" ON "tender_sources"("code");

-- CreateIndex
CREATE INDEX "tender_sources_isEnabled_nextRunAt_idx" ON "tender_sources"("isEnabled", "nextRunAt");

-- CreateIndex
CREATE INDEX "tender_sources_status_idx" ON "tender_sources"("status");

-- CreateIndex
CREATE INDEX "tender_sources_category_idx" ON "tender_sources"("category");

-- CreateIndex
CREATE INDEX "tenders_sourceId_referenceNumber_idx" ON "tenders"("sourceId", "referenceNumber");

-- CreateIndex
CREATE INDEX "tenders_sourceExternalId_idx" ON "tenders"("sourceExternalId");

-- CreateIndex
CREATE INDEX "tenders_needsReview_idx" ON "tenders"("needsReview");

-- AddForeignKey
ALTER TABLE "tender_sources" ADD CONSTRAINT "tender_sources_provinceId_fkey" FOREIGN KEY ("provinceId") REFERENCES "provinces"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "source_runs" ADD CONSTRAINT "source_runs_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "tender_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "source_documents" ADD CONSTRAINT "source_documents_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "tender_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "source_documents" ADD CONSTRAINT "source_documents_runId_fkey" FOREIGN KEY ("runId") REFERENCES "source_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "source_documents" ADD CONSTRAINT "source_documents_tenderId_fkey" FOREIGN KEY ("tenderId") REFERENCES "tenders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tender_imports" ADD CONSTRAINT "tender_imports_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "tender_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tender_imports" ADD CONSTRAINT "tender_imports_runId_fkey" FOREIGN KEY ("runId") REFERENCES "source_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tender_imports" ADD CONSTRAINT "tender_imports_tenderId_fkey" FOREIGN KEY ("tenderId") REFERENCES "tenders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tender_imports" ADD CONSTRAINT "tender_imports_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "source_documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tender_provenance" ADD CONSTRAINT "tender_provenance_tenderId_fkey" FOREIGN KEY ("tenderId") REFERENCES "tenders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tender_provenance" ADD CONSTRAINT "tender_provenance_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "source_documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tender_duplicate_reviews" ADD CONSTRAINT "tender_duplicate_reviews_tenderId_fkey" FOREIGN KEY ("tenderId") REFERENCES "tenders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tender_duplicate_reviews" ADD CONSTRAINT "tender_duplicate_reviews_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "tenders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tender_duplicate_reviews" ADD CONSTRAINT "tender_duplicate_reviews_importId_fkey" FOREIGN KEY ("importId") REFERENCES "tender_imports"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tender_duplicate_reviews" ADD CONSTRAINT "tender_duplicate_reviews_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

