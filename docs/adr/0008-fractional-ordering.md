# 0008 — Fractional indexing for board and backlog order

- Status: Accepted
- Date: 2026-10-29

## Context

Integer positions force renumbering on insert and race under concurrent drags.

## Decision

Order is a base-62 fractional key (`rank text collate "C"`). Moving an item computes a key between its new
neighbours and updates one row. Keys get a short random jitter suffix so concurrent inserts into the same gap stay
distinct. A job rebalances a column when any key exceeds 32 characters.

## Consequences

- O(1) writes per move, trivially optimistic on the client (the client computes the same key).
- Ordering lives in `packages/domain`, shared by client and server.

## Update (2026-10-29)

`needsRebalance` implements the 32-character check, but no job runs it yet: realistic use stays far below the
threshold. The job is listed under Deferred in the roadmap.

## Update (2026-10-30)

The job exists: `rank.rebalance` runs nightly in the worker. It re-keys every task in an affected column (deleted
ones too, so a restore lands where it was), bumps their versions and emits `tasks.reordered`. A Postgres advisory
lock per column, shared for moves and exclusive for the rebalance, keeps a move from computing its key against
ranks that are being replaced.
