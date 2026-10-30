import { sql } from 'drizzle-orm';
import type { Database } from '../client.ts';

/** Postgres NOTIFY channel the outbox insert trigger uses to wake the relay. */
export const OUTBOX_WAKE_CHANNEL = 'teamflow_outbox';

export interface RelayOptions {
  /** NOTIFY channel to publish events on. */
  channel: string;
  batchSize?: number;
  /** Called for an event too large to NOTIFY; it is marked published without being sent. */
  onOversized?: (id: string, topic: string, bytes: number) => void;
}

/** Postgres refuses NOTIFY payloads of 8000 bytes or more. */
export const MAX_NOTIFY_BYTES = 7999;

interface PendingRow extends Record<string, unknown> {
  id: string;
  organization_id: string;
  topic: string;
  payload: Record<string, unknown>;
  created_at: Date | string;
}

/**
 * Publish one batch of pending outbox events (ADR-0007). Returns how many were published.
 *
 * Runs in one transaction: rows are claimed with `FOR UPDATE SKIP LOCKED` (so concurrent relays split the work
 * instead of duplicating it), notified in id order (UUID v7, so creation order), and marked published. Postgres
 * delivers the notifications only when the transaction commits, so an event is never announced without being
 * marked, nor marked without being announced.
 */
export function relayOutbox(
  db: Database,
  { channel, batchSize = 200, onOversized }: RelayOptions,
): Promise<number> {
  return db.transaction(async (tx) => {
    const rows = await tx.execute<PendingRow>(sql`
      select id, organization_id, topic, payload, created_at
      from outbox
      where published_at is null
      order by id
      limit ${batchSize}
      for update skip locked
    `);
    if (rows.length === 0) return 0;

    for (const row of rows) {
      const message = JSON.stringify({
        id: row.id,
        organizationId: row.organization_id,
        topic: row.topic,
        payload: row.payload,
        at: new Date(row.created_at).toISOString(),
      });
      // One oversized event must not fail the batch forever (it would head every later batch); it is skipped and
      // reported instead. Producers keep payloads to ids, so this is a safety net, not a path.
      const bytes = Buffer.byteLength(message);
      if (bytes > MAX_NOTIFY_BYTES) {
        onOversized?.(row.id, row.topic, bytes);
        continue;
      }
      await tx.execute(sql`select pg_notify(${channel}, ${message})`);
    }
    await tx.execute(sql`
      update outbox set published_at = now()
      where id in (${sql.join(
        rows.map((r) => sql`${r.id}::uuid`),
        sql`, `,
      )})
    `);
    return rows.length;
  });
}

/** Delete events published more than `days` ago. The activity log, not the outbox, is the history. */
export async function pruneOutbox(db: Database, days = 7): Promise<number> {
  const rows = await db.execute(sql`
    delete from outbox
    where published_at is not null and published_at < now() - make_interval(days => ${days})
    returning id
  `);
  return rows.length;
}
