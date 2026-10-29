---

name: teamflow-review
description: Review checklist for TeamFlow code — tenancy, contract, transactions, concurrency, realtime, frontend state and tests. Use when reviewing a diff or PR in this repo, or self-reviewing before opening one.
---

# TeamFlow review checklist

Go through the diff with these questions. Report each finding with file:line, the concrete failure it causes, and a
fix. Skip style nits Biome already enforces.

## Tenancy (highest severity)

- Does any procedure accept `organizationId` (or derive it from input)? It must come from `context.scope`.
- Is any tenant-owned table queried outside `Scope` or imported outside `packages/db`?
- New tenant table: `organization_id`, unique `(organization_id, id)`, composite FKs, `organization_id`-led
  indexes, an isolation test case?
- Realtime: are channel subscriptions authorized against the caller's membership?

## Contract and layering

- Is the procedure declared in `packages/contract` with input, output and typed errors?
- Does a handler contain rules, or a service import table objects?
- Hand-written types duplicating a contract/inferred type?

## Transactions and side effects

- Is the mutation one transaction containing the change, `activity` rows and `outbox` events?
- Any email/HTTP/realtime publish inside the transaction or before commit?
- Read-then-write on an invariant without a lock (`for update` / advisory lock)?

## Concurrency

- Mutable aggregate updated without checking `version`?
- Ordering written as integers or renumbering neighbours instead of a fractional `rank`?

## Errors and authorization

- Unseeable resource → `NOT_FOUND`; seeable but not permitted → `FORBIDDEN`; stale/conflict → `CONFLICT`.
- Authorization done on a loaded resource with the shared statements from `packages/auth`?

## Frontend

- Server data copied into local state or a global store instead of read from TanStack Query?
- Optimistic update without rollback, or cache patch that ignores `version` ordering?
- Filters/view state not in validated search params?
- Keyboard access and labels on icon-only controls?

## Tests

- Branching logic without unit tests? API behaviour without an integration test? Any `sleep`/real timers?
