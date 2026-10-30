import { createScope, type Database, rebalanceCandidates, rebalanceColumn } from '@teamflow/db';

/** The pg-boss queue the rank rebalance pass is scheduled on. */
export const REBALANCE_QUEUE = 'rank.rebalance';

/**
 * One rebalance pass (ADR-0008): every column holding an overlong rank gets fresh keys. Realistic use rarely gets
 * there, so a pass is usually one scan that finds nothing. Returns how many tasks were re-ranked.
 */
export async function runRebalance(db: Database): Promise<number> {
  let moved = 0;
  for (const column of await rebalanceCandidates(db)) {
    moved += await rebalanceColumn(createScope(db, column.organizationId, null), column.statusId);
  }
  return moved;
}
