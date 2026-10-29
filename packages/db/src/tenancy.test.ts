import { describe, expect, test } from 'bun:test';
import { getTableName } from 'drizzle-orm';
import { index, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import * as schema from './schema/index.ts';
import { projects } from './schema/projects.ts';
import { tenantColumns, tenantKey, tenantRef } from './schema/tenant.ts';
import { PLATFORM_TABLES, tablesOf, tenancyProblems } from './tenancy.ts';

describe('the real schema', () => {
  const tables = tablesOf(schema);

  test('has tenant tables to check', () => {
    expect(tables.filter((t) => !PLATFORM_TABLES.has(getTableName(t))).length).toBeGreaterThan(3);
  });

  for (const table of tables) {
    test(`${getTableName(table)} follows the tenancy rules`, () => {
      expect(tenancyProblems(table)).toEqual([]);
    });
  }
});

describe('the rules catch', () => {
  test('a table without organization_id', () => {
    const bad = pgTable('bad_no_org', { id: uuid().primaryKey(), name: text() });
    expect(tenancyProblems(bad)).toContain(
      'bad_no_org: organization_id must exist and be not null',
    );
  });

  test('a missing (organization_id, id) key', () => {
    const bad = pgTable('bad_no_key', { ...tenantColumns(), name: text() });
    expect(tenancyProblems(bad)).toEqual(['bad_no_key: needs unique (organization_id, id)']);
  });

  test('a single-column reference to another tenant table', () => {
    const bad = pgTable(
      'bad_ref',
      { ...tenantColumns(), projectId: uuid().references(() => projects.id) },
      (t) => [tenantKey(t)],
    );
    expect(tenancyProblems(bad)).toEqual([
      'bad_ref: reference to projects (project_id) must be composite on organization_id',
    ]);
  });

  test('an index that does not lead with organization_id', () => {
    const bad = pgTable('bad_index', { ...tenantColumns(), name: text() }, (t) => [
      tenantKey(t),
      index('bad_index_name').on(t.name),
    ]);
    expect(tenancyProblems(bad)).toEqual(['bad_index: index bad_index_name leads with name']);
  });

  test('and accept a well-formed table', () => {
    const good = pgTable('good', { ...tenantColumns(), projectId: uuid().notNull() }, (t) => [
      tenantKey(t),
      tenantRef(t, t.projectId, projects),
      index().on(t.organizationId, t.projectId),
    ]);
    expect(tenancyProblems(good)).toEqual([]);
  });
});
