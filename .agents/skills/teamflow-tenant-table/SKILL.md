---

name: teamflow-tenant-table
description: Add a tenant-owned table (or column referencing one) to the TeamFlow Drizzle schema with composite keys, a reviewed migration and tests. Use whenever packages/db/src/schema changes.
---

# Adding a tenant-owned table

## Schema — `packages/db/src/schema/<area>.ts`

```ts
export const comments = pgTable(
  'comments',
  {
    ...tenantColumns(), // id (uuid v7) + organization_id → organizations
    taskId: uuid().notNull(),
    authorMemberId: uuid(), // people are members, never users
    body: text().notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    tenantKey(t), // unique (organization_id, id)
    tenantRef(t, t.taskId, tasks).onDelete('cascade'), // composite FK
    tenantRef(t, t.authorMemberId, members), // SET NULL (column) is added by hand, see below
    index().on(t.organizationId, t.taskId, t.createdAt), // indexes lead with organization_id
  ],
);
```

- Export it from `schema/index.ts`. Timestamps are `timestamptz(3)` via the helpers.
- Name expression indexes explicitly (`uniqueIndex('labels_name_unique')`).
- An index that must not lead with `organization_id` needs an entry, with a reason, in `CROSS_TENANT_INDEXES`
  in `src/tenancy.ts`.

## Migration

```bash
bun run db:generate -- --name comments
```

Read the SQL. Hand edits, with a comment at the top of the file saying what and why:

- nullable member references: `ON DELETE SET NULL ("author_member_id")` (column list — never null `organization_id`)
- fractional ranks: `"rank" text COLLATE "C"`
- if a constraint is created after something that depends on it, reorder the statements

Never edit a migration that has landed on `dev`; add a new one.

## Tests

- `src/tenancy.test.ts` checks the new table automatically — make sure it passes.
- Add a case to `src/constraints.test.ts` if the table introduces a new kind of reference.
- The repository/procedure tests must include cross-tenant reads and writes.
