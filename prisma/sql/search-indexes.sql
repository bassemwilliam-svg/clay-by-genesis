-- Genesis Forge — search & embedding infrastructure.
--
-- Prisma can declare the `searchVector tsvector` and `embedding vector(1024)`
-- columns (as Unsupported types) but cannot express their operator-class
-- indexes or the FTS trigger. Apply this file AFTER the baseline migration:
--
--   npx prisma migrate dev --name init        # creates tables + columns
--   npx prisma db execute --file prisma/sql/search-indexes.sql --schema prisma/schema.prisma
--
-- It is idempotent, so re-running after later migrations is safe.

-- Extensions (pgvector is also listed in schema's postgresqlExtensions; this is
-- a belt-and-suspenders guard for environments where that wasn't applied).
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ---------------------------------------------------------------------------
-- Full-text search: keep Product.searchVector in sync with the text columns.
-- Title is weighted highest (A), short desc (B), full desc (C).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION product_search_vector_update()
RETURNS trigger AS $$
BEGIN
  NEW."searchVector" :=
    setweight(to_tsvector('english', coalesce(NEW."title", '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW."shortDesc", '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW."fullDesc", '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS product_search_vector_trigger ON "Product";
CREATE TRIGGER product_search_vector_trigger
BEFORE INSERT OR UPDATE OF "title", "shortDesc", "fullDesc"
ON "Product"
FOR EACH ROW EXECUTE FUNCTION product_search_vector_update();

-- Backfill any rows that predate the trigger.
UPDATE "Product" SET "title" = "title";

-- GIN index for the tsvector (keyword search / ranking).
CREATE INDEX IF NOT EXISTS product_search_vector_idx
ON "Product" USING GIN ("searchVector");

-- Trigram index on title for fast typeahead / fuzzy matching.
CREATE INDEX IF NOT EXISTS product_title_trgm_idx
ON "Product" USING GIN ("title" gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- Semantic search: HNSW index on the embedding (cosine distance).
-- HNSW needs no training step and gives strong recall as the catalog grows.
-- Built only over PUBLISHED rows is not possible (no partial HNSW on the
-- expression), so we index all; the concierge filters status at query time.
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS product_embedding_hnsw_idx
ON "Product" USING hnsw ("embedding" vector_cosine_ops);
