# Engineering conventions

These are the working rules. If one is wrong, change it in a PR with a reason (and an ADR if it is a real decision).

## TypeScript

- `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`. No `any`; unknown input is `unknown`, narrowed
  by Zod. No non-null `!` outside tests.
- ES modules everywhere. Packages export TypeScript source; only deployables build.
- Names: files `kebab-case.ts`, React components `PascalCase.tsx` exported by name, no default exports except where a
  framework requires them (route files, config files).

## API (`apps/api`)

- **Layering:** procedure (oRPC handler) → service → `scope.db` queries. Handlers parse and delegate; services own
  rules and authorization; only `packages/db` touches tables directly.
- **Contract first.** A new procedure starts in `packages/contract`. Never hand-write a type that the contract already
  infers.
- **Tenancy:** never accept `organizationId` as input; read it from `context.scope`. See ADR-0004.
- **Authorization in services** on loaded resources, via `can(role, statement)` from `packages/auth`.
  Reading something you may not see is `NOT_FOUND`; acting on something you can see but may not change is
  `FORBIDDEN`.
- **Concurrency:** mutable aggregates (task, project, sprint) carry `version`. Updates send the version they read;
  a mismatch is `CONFLICT`. Invariants over several rows take a row lock (`for update`) or an advisory lock.
- **One transaction per mutation**, containing the change, its `activity` rows and its `outbox` events. No side
  effects (email, HTTP, realtime) inside the transaction.
- **Time** comes from an injected `Clock`; tests never sleep.
- IDs are UUID v7. Timestamps are `timestamptz`.

## Database (`packages/db`)

- Column names `snake_case`, TypeScript properties `camelCase` (Drizzle `casing: 'snake_case'`).
- Every tenant-owned table: `organization_id`, unique `(organization_id, id)`, composite FKs, indexes led by
  `organization_id`, an entry in the isolation suite.
- Migrations are reviewed as SQL. Never edit a migration that has landed on `dev`.

## Web (`apps/web`)

- Server state lives in TanStack Query only. No copying query data into component state or a global store.
- Mutations are optimistic when the outcome is predictable (move, rename, assign), with rollback on error.
- URL is state: filters, view mode and selected task are search params validated by the route's schema.
- Every interactive element is keyboard reachable; every icon-only button has an accessible label.

## Testing

- `packages/domain`: unit tests for every branch; property tests for ordering and metrics.
- `apps/api`: integration tests against a real Postgres (`bun test` with a per-file schema), including the
  cross-tenant isolation suite. Services with branching rules get unit tests in the same PR.
- `apps/web`: component tests for non-trivial hooks/components; Playwright for the critical journeys.

## Git

- Branch from `dev`: `feat/…`, `fix/…`, `chore/…`, `docs/…`, `refactor/…`, `test/…`.
- Conventional Commits with a scope: `feat(api): …`, `fix(web): …`, `chore(db): …`, `docs: …`.
- Small PRs, one concern each, squash-merged into `dev`. `main` only receives release merges from `dev`.
