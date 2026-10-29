import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema/index.ts';

export type Schema = typeof schema;
export type Database = PostgresJsDatabase<Schema>;
/** A Drizzle transaction handle; services receive this inside `db.transaction`. */
export type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];
/** Either the root database or a transaction — what query helpers accept. */
export type Executor = Database | Transaction;

export interface DatabaseOptions {
  url: string;
  /** Maximum pooled connections. */
  max?: number;
  /** Application name reported to Postgres, visible in `pg_stat_activity`. */
  applicationName?: string;
}

export interface DatabaseHandle {
  db: Database;
  sql: postgres.Sql;
  close(): Promise<void>;
}

export function createDatabase({
  url,
  max = 10,
  applicationName = 'teamflow',
}: DatabaseOptions): DatabaseHandle {
  const sql = postgres(url, {
    max,
    onnotice: () => {},
    connection: { application_name: applicationName },
  });
  const db = drizzle(sql, { schema, casing: 'snake_case' });
  return { db, sql, close: () => sql.end({ timeout: 5 }) };
}
