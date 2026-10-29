import { getTableName, is } from 'drizzle-orm';
import { getTableConfig, PgTable } from 'drizzle-orm/pg-core';

/**
 * The schema half of ADR-0004 as a function, so the rules can be run over the real schema in CI and over
 * deliberately broken tables in their own tests.
 */

/** Platform-class tables: not owned by any one organization. */
export const PLATFORM_TABLES = new Set([
  'users',
  'sessions',
  'accounts',
  'verifications',
  'rate_limits',
  'organizations',
  // Owned by Better Auth and keyed by team; reachable only through `teams`, which is tenant-owned.
  'team_members',
]);

/**
 * Indexes allowed to lead with something other than organization_id, each a lookup that is legitimately
 * cross-tenant and keyed by the authenticated user.
 */
const CROSS_TENANT_INDEXES = new Set([
  'members.user_id', // "which organizations can I enter?"
  'invitations.email', // "which invitations are waiting for me?"
]);

// Drizzle keeps property names in table config; `casing: 'snake_case'` maps them when SQL is built.
const snake = (name: string) => name.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
const columnNames = (columns: { name: string }[]) => columns.map((c) => snake(c.name));

export const tablesOf = (module: Record<string, unknown>): PgTable[] =>
  Object.values(module).filter((value): value is PgTable => is(value, PgTable));

export function tenancyProblems(table: PgTable): string[] {
  const config = getTableConfig(table);
  const name = config.name;
  if (PLATFORM_TABLES.has(name)) return [];
  const problems: string[] = [];

  const orgColumn = config.columns.find((c) => snake(c.name) === 'organization_id');
  if (!orgColumn?.notNull) problems.push(`${name}: organization_id must exist and be not null`);

  const referencesOrg = config.foreignKeys.some((f) => {
    const ref = f.reference();
    return (
      getTableName(ref.foreignTable) === 'organizations' &&
      columnNames(ref.columns).join() === 'organization_id'
    );
  });
  if (!referencesOrg) problems.push(`${name}: organization_id must reference organizations`);

  if (config.columns.some((c) => c.name === 'id')) {
    const keyed = config.uniqueConstraints.some(
      (u) => columnNames(u.columns).sort().join() === 'id,organization_id',
    );
    if (!keyed) problems.push(`${name}: needs unique (organization_id, id)`);
  }

  for (const fk of config.foreignKeys) {
    const ref = fk.reference();
    const target = getTableName(ref.foreignTable);
    if (PLATFORM_TABLES.has(target)) continue;
    const local = columnNames(ref.columns);
    const foreign = columnNames(ref.foreignColumns);
    if (local.length !== 2 || local[0] !== 'organization_id' || foreign[0] !== 'organization_id') {
      problems.push(
        `${name}: reference to ${target} (${local.join(', ')}) must be composite on organization_id`,
      );
    }
  }

  for (const index of config.indexes) {
    const first = index.config.columns[0] as { name?: string } | undefined;
    const lead = first?.name ? snake(first.name) : 'expression';
    if (lead === 'organization_id' || CROSS_TENANT_INDEXES.has(`${name}.${lead}`)) continue;
    problems.push(`${name}: index ${index.config.name ?? '(unnamed)'} leads with ${lead}`);
  }

  return problems;
}
