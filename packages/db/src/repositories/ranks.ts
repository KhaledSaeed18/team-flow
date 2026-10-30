import { REBALANCE_THRESHOLD, ranksBetween } from '@teamflow/domain';
import { and, asc, eq, sql } from 'drizzle-orm';
import type { Database } from '../client.ts';
import { tasks } from '../schema/tasks.ts';
import { inTransaction, type Scope } from '../scope.ts';
import { emit } from './events.ts';

/**
 * Rank rebalancing (ADR-0008). Inserting into the same gap over and over grows keys by a character each time;
 * once a column has a key longer than `REBALANCE_THRESHOLD`, its tasks get fresh, short keys in the same order.
 *
 * Every write that computes a rank from a column's neighbours holds that column's lock in shared mode
 * (`lockColumn`), and a rebalance holds it exclusively, so a move never computes its key from ranks that a
 * rebalance is replacing underneath it.
 */

const columnKey = (statusId: string) => sql`hashtextextended(${statusId}::text, 0)`;

/** Taken by every rank computation inside a column, so that a rebalance waits for it and vice versa. */
export async function lockColumn(scope: Scope, statusId: string): Promise<void> {
  await scope.db.execute(sql`select pg_advisory_xact_lock_shared(${columnKey(statusId)})`);
}

export interface RebalanceCandidate {
  organizationId: string;
  statusId: string;
}

/** Columns, across every workspace, holding a key long enough to rebalance. */
export async function rebalanceCandidates(db: Database): Promise<RebalanceCandidate[]> {
  return db
    .selectDistinct({ organizationId: tasks.organizationId, statusId: tasks.statusId })
    .from(tasks)
    .where(sql`length(${tasks.rank}) > ${REBALANCE_THRESHOLD}`);
}

/**
 * Give every task in a column a fresh key, keeping their order. Deleted tasks are included, so that restoring one
 * puts it back where it was. Each task's version is bumped (caches holding the old rank must not win over the new
 * one) and one `tasks.reordered` event tells open boards to reload the column. Returns how many tasks moved.
 */
export function rebalanceColumn(scope: Scope, statusId: string): Promise<number> {
  return inTransaction(scope, async (tx) => {
    await tx.db.execute(sql`select pg_advisory_xact_lock(${columnKey(statusId)})`);
    const column = and(eq(tasks.organizationId, tx.organizationId), eq(tasks.statusId, statusId));
    const rows = await tx.db
      .select({ id: tasks.id, rank: tasks.rank, projectId: tasks.projectId })
      .from(tasks)
      .where(column)
      .orderBy(asc(tasks.rank), asc(tasks.id))
      .for('update');
    const first = rows[0];
    if (!first) return 0;

    const ranks = ranksBetween(null, null, rows.length, { jitter: 0 });
    let moved = 0;
    for (const [i, row] of rows.entries()) {
      const rank = ranks[i];
      if (rank === undefined || rank === row.rank) continue;
      await tx.db
        .update(tasks)
        .set({ rank, version: sql`${tasks.version} + 1` })
        .where(and(column, eq(tasks.id, row.id)));
      moved++;
    }
    if (moved > 0) await emit(tx, 'tasks.reordered', { projectId: first.projectId, statusId });
    return moved;
  });
}
