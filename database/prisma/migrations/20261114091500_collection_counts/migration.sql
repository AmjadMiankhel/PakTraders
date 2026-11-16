-- AlterTable
ALTER TABLE "source_runs" ADD COLUMN     "itemsUnchanged" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "tender_imports" ADD COLUMN     "changeCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "rawHash" TEXT;
