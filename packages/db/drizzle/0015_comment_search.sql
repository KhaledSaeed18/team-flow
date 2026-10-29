-- Full-text search over comments, so a task can be found by what was said about it (ADR-0006). Same shape as the
-- task search column: a generated 'simple' tsvector and a GIN index that leads with organization_id. Deleted
-- comments are skipped by the query, not the index.
ALTER TABLE "comments" ADD COLUMN "search" tsvector GENERATED ALWAYS AS (
  to_tsvector('simple', coalesce("body", ''))
) STORED;
--> statement-breakpoint
CREATE INDEX "comments_search_idx" ON "comments" USING gin ("organization_id", "search");
