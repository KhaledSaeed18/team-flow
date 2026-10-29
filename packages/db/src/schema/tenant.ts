import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import { foreignKey, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { newId } from '../ids.ts';
import { organizations } from './auth.ts';

/**
 * Building blocks for tenant-owned tables (ADR-0004). Every tenant table spreads `tenantColumns()` and adds
 * `tenantKey(t)` to its constraints; every reference to another tenant table goes through `tenantRef`, which makes
 * the foreign key composite on `organization_id` so a row can never point into another organization.
 *
 * `tenancy.test.ts` walks the whole schema and fails if any of this is missing.
 */

export const tenantColumns = () => ({
  id: uuid().primaryKey().$defaultFn(newId),
  organizationId: uuid()
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
});

export const createdAt = () =>
  timestamp({ withTimezone: true, precision: 3 }).notNull().defaultNow();
export const updatedAt = () =>
  timestamp({ withTimezone: true, precision: 3 })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());
export const at = () => timestamp({ withTimezone: true, precision: 3 });

interface TenantRow {
  organizationId: AnyPgColumn;
  id: AnyPgColumn;
}

/** The unique `(organization_id, id)` that composite foreign keys point at. */
export const tenantKey = (t: TenantRow) => unique().on(t.organizationId, t.id);

/** A composite foreign key `(organization_id, column) → target(organization_id, id)`. */
export const tenantRef = (
  t: { organizationId: AnyPgColumn },
  column: AnyPgColumn,
  target: TenantRow,
) =>
  foreignKey({
    columns: [t.organizationId, column],
    foreignColumns: [target.organizationId, target.id],
  });
