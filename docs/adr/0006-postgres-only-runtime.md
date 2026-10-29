# 0006 — Postgres for queues, pub/sub and search — no Redis

- Status: Accepted
- Date: 2026-10-29

## Context

A typical stack adds Redis for jobs, pub/sub and rate limiting, and a search engine for search. Each adds a service
to run, back up and keep consistent with the database.

## Decision

- **Jobs:** pg-boss (retries, backoff, scheduling, singleton keys, dead letters) in the same database.
- **Pub/sub:** `LISTEN/NOTIFY` for realtime fan-out between api nodes; payloads carry ids, not data, so the 8 KB limit
  never matters.
- **Search:** generated `tsvector` columns with GIN indexes, `websearch_to_tsquery`, `pg_trgm` for fuzzy key/title match.
- **Rate limits:** a token-bucket table updated with a single upsert.

## Consequences

- One stateful service to operate; jobs can be enqueued in the same transaction as the change.
- If load ever outgrows this, each piece has a clear seam to swap.
