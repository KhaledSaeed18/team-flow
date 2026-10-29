---

name: teamflow-procedure
description: Add or change an API procedure in TeamFlow end to end — contract, repository, service, router and integration test. Use whenever a new endpoint, query or mutation is needed in apps/api.
---

# Adding a TeamFlow procedure

Work through the layers in this order. Each is a separate commit.

## 1. Contract — `packages/contract/src/routers/<area>.ts`

```ts
export const tasks = {
  archive: base
    .route({
      method: 'POST',
      path: '/tasks/{id}/archive',
      summary: 'Archive a task',
      tags: ['Tasks'],
    })
    .errors({ INVALID_REFERENCE: { status: 422, message: '…' } }) // only errors beyond `base`
    .input(z.object({ id: Id, version: Version }))
    .output(Task),
};
```

- Reuse shared schemas (`Id`, `Version`, `Timestamp`, `Color`) and domain enums (`Priority`, `StatusCategory`).
- Never put `organizationId` in an input.
- Mutations of versioned aggregates take `version`.
- New router? Register it in `packages/contract/src/index.ts`.

## 2. Repository — `packages/db/src/repositories/<area>.ts`

- Takes `scope: Scope` first; every statement filters `eq(table.organizationId, scope.organizationId)`.
- Mutations: `inTransaction(scope, async (tx) => …)` containing the change, `recordActivity(tx, …, at: now)` and
  `emit(tx, topic, payload)`. Lock rows you check invariants on (`.for('update')`).
- Versioned update: lock → compare `version` → throw `StaleWriteError(current.version)` → `version + 1`.
- References that exist but do not fit → `InvalidReferenceError`. Return `null` for "not found".
- Export from `repositories/index.ts`.

## 3. Service — `apps/api/src/services/<area>.ts`

- Signature `(actor: Actor, …args, now?: Date)`.
- Order: load (404 via `notFound()`), then `authorize(actor, { resource: ['action'] })` (403), then mutate.
- Map unique violations to a named error (`uniqueViolation(error)` → `AppError('NAME_TAKEN')`).
- No Drizzle, no table imports — Biome blocks them outside `packages/db`.

## 4. Router — `apps/api/src/routers/<area>.ts`

```ts
archive: os.tasks.archive.use(tenant).handler(({ context, input }) =>
  tasksService.archive(context, input.id, input.version, context.clock.now())),
```

Strip `undefined` from patches with `withoutUndefined`. Register new routers in `routers/index.ts`.

## 5. Test — `apps/api/test/<area>.test.ts`

Use the harness: `h.owner()`, `h.join(owner, name, role)`, `h.user()`, `client.<router>.<procedure>()`, `h.clock`.
Cover: happy path, validation, permission per role, `CONFLICT` on stale version, and **cross-tenant** access
(another org's owner gets `NOT_FOUND` for reads _and_ writes).

Run `bun run check` before opening the PR.
