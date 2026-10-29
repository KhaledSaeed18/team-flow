import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { sql } from 'drizzle-orm';
import { createTestDatabase, type TestDatabase } from './testing.ts';

describe('createTestDatabase', () => {
  let a: TestDatabase;
  let b: TestDatabase;

  beforeAll(async () => {
    [a, b] = await Promise.all([createTestDatabase(), createTestDatabase()]);
  });

  afterAll(async () => {
    await Promise.all([a.destroy(), b.destroy()]);
  });

  test('gives each caller its own migrated database', async () => {
    expect(a.url).not.toBe(b.url);
    const rows = await a.db.execute<{ extname: string }>(
      sql`select extname from pg_extension where extname = 'pg_trgm'`,
    );
    expect(rows.map((r) => r.extname)).toEqual(['pg_trgm']);
  });

  test('databases are isolated from each other', async () => {
    await a.db.execute(sql`create table probe (id int)`);
    const rows = await b.db.execute(sql`select to_regclass('probe') as t`);
    expect(rows[0]?.t).toBeNull();
  });
});
