-- Full-text search over tasks (ADR-0006): a generated, weighted tsvector (title ranks above description) with a GIN
-- index, and a trigram index on titles for typo-tolerant matching. The 'simple' configuration avoids stemming
-- surprises across languages; ranking does the rest.
-- btree_gin lets one GIN index lead with organization_id, keeping every lookup tenant-scoped.
CREATE EXTENSION IF NOT EXISTS btree_gin;
--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "search" tsvector GENERATED ALWAYS AS (
  setweight(to_tsvector('simple', coalesce("title", '')), 'A') ||
  setweight(to_tsvector('simple', coalesce("description", '')), 'B')
) STORED;
--> statement-breakpoint
CREATE INDEX "tasks_search_idx" ON "tasks" USING gin ("organization_id", "search");
--> statement-breakpoint
CREATE INDEX "tasks_title_trgm_idx" ON "tasks" USING gin ("organization_id", "title" gin_trgm_ops);
