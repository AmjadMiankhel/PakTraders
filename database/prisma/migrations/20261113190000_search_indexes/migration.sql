-- Full-text / fuzzy search support for tender titles and descriptions.
-- Prisma has no native tsvector/trgm support, so these indexes are maintained
-- directly in SQL. Phase 1 uses ILIKE + trigram similarity ranking; the same
-- indexes support a later switch to tsquery.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "tenders_title_trgm_idx"
  ON "tenders" USING gin ("title" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "tenders_description_trgm_idx"
  ON "tenders" USING gin ("description" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "tenders_reference_number_idx"
  ON "tenders" ("referenceNumber");

-- Published tenders ordered by closing date is the hottest public query.
CREATE INDEX IF NOT EXISTS "tenders_public_listing_idx"
  ON "tenders" ("status", "publishedAt" DESC, "closingAt" ASC)
  WHERE "deletedAt" IS NULL;
