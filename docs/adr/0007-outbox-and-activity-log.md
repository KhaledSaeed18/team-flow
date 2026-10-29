# 0007 — Transactional outbox and append-only activity log

- Status: Accepted
- Date: 2026-10-29

## Context

v1 wrote audit logs fire-and-forget from an interceptor and sent notifications inline, so a crash could lose either
and a failed email could fail a request. Analytics need a trustworthy history of every state change.

## Decision

- Each mutation appends **activity** rows (entity, field, from, to, actor, at) and **outbox** events in the same
  transaction as the change.
- A relay in `apps/worker` consumes the outbox (woken by `NOTIFY`, with a polling fallback), publishes realtime
  events and enqueues side-effect jobs; it marks rows processed idempotently.
- Activity is never updated or deleted; it is the source for task history, audit views and all sprint metrics.

## Consequences

- Side effects are at-least-once; consumers are idempotent by event id.
- Writes are slightly larger; the activity table is partitioned by month once it grows.
