import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import postgres from 'postgres';
import { createDatabase, type DatabaseHandle } from './client.ts';
import { newId } from './ids.ts';
import { MIGRATIONS_FOLDER, runMigrations } from './migrate.ts';

/**
 * Integration tests get their own throwaway database, cloned from a migrated template.
 *
 * `CREATE DATABASE … TEMPLATE …` is a file-level copy, so a fresh, fully migrated database costs tens of
 * milliseconds. The template is keyed by a hash of the migration files, so changing a migration rebuilds it.
 */

const DEFAULT_TEST_URL = 'postgres://teamflow:teamflow@localhost:5442/teamflow_test';

const testUrl = (): URL => new URL(process.env.TEST_DATABASE_URL ?? DEFAULT_TEST_URL);

const withDatabase = (url: URL, name: string): string => {
  const next = new URL(url);
  next.pathname = `/${name}`;
  return next.toString();
};

async function migrationsHash(): Promise<string> {
  const hash = createHash('sha256');
  const entries = await readdir(MIGRATIONS_FOLDER, { recursive: true }).catch(() => []);
  for (const entry of entries.sort()) {
    if (!entry.endsWith('.sql') && !entry.endsWith('.json')) continue;
    hash.update(entry);
    hash.update(await readFile(join(MIGRATIONS_FOLDER, entry)));
  }
  return hash.digest('hex').slice(0, 12);
}

let templateName: Promise<string> | undefined;

async function ensureTemplate(admin: postgres.Sql, base: URL): Promise<string> {
  const name = `teamflow_template_${await migrationsHash()}`;
  // Serialise template creation across concurrently running test processes.
  await admin`select pg_advisory_lock(hashtext(${name}))`;
  try {
    const [existing] = await admin`select 1 from pg_database where datname = ${name}`;
    if (!existing) {
      const building = `${name}_building`;
      await admin.unsafe(`drop database if exists "${building}"`);
      await admin.unsafe(`create database "${building}"`);
      await runMigrations(withDatabase(base, building));
      await admin.unsafe(`alter database "${building}" rename to "${name}"`);
    }
  } finally {
    await admin`select pg_advisory_unlock(hashtext(${name}))`;
  }
  return name;
}

export interface TestDatabase extends DatabaseHandle {
  url: string;
  /** Drop the database. Call from `afterAll`. */
  destroy(): Promise<void>;
}

export async function createTestDatabase(): Promise<TestDatabase> {
  const base = testUrl();
  const admin = postgres(base.toString(), { max: 1, onnotice: () => {} });
  try {
    templateName ??= ensureTemplate(admin, base);
    const template = await templateName;
    const name = `teamflow_t_${newId().replaceAll('-', '').slice(-16)}`;
    await admin.unsafe(`create database "${name}" template "${template}"`);
    const url = withDatabase(base, name);
    const handle = createDatabase({ url, max: 5, applicationName: 'teamflow-test' });
    return {
      ...handle,
      url,
      async destroy() {
        await handle.close();
        const cleanup = postgres(base.toString(), { max: 1, onnotice: () => {} });
        try {
          await cleanup.unsafe(`drop database if exists "${name}" with (force)`);
        } finally {
          await cleanup.end({ timeout: 5 });
        }
      },
    };
  } finally {
    await admin.end({ timeout: 5 });
  }
}
