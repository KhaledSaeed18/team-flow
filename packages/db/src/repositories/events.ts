import { activity, type FieldChange, outbox } from '../schema/tasks.ts';
import type { Scope } from '../scope.ts';

/**
 * Every mutation records what changed (activity) and what to tell the world (outbox) in its own transaction
 * (ADR-0007). Call these with the transaction-bound scope from `inTransaction`.
 */

export interface ActivityInput {
  kind: string;
  projectId?: string | null;
  taskId?: string | null;
  changes?: FieldChange[];
}

export async function recordActivity(scope: Scope, input: ActivityInput): Promise<void> {
  await scope.db.insert(activity).values({
    organizationId: scope.organizationId,
    actorMemberId: scope.memberId,
    kind: input.kind,
    projectId: input.projectId ?? null,
    taskId: input.taskId ?? null,
    changes: input.changes ?? [],
  });
}

export async function emit(
  scope: Scope,
  topic: string,
  payload: Record<string, unknown>,
): Promise<void> {
  await scope.db.insert(outbox).values({ organizationId: scope.organizationId, topic, payload });
}

/** Field-level differences between two snapshots, limited to `fields`. Dates compare by instant. */
export function diff<T extends Record<string, unknown>>(
  before: T,
  after: T,
  fields: readonly (keyof T & string)[],
): FieldChange[] {
  const normalize = (value: unknown) => (value instanceof Date ? value.toISOString() : value);
  const changes: FieldChange[] = [];
  for (const field of fields) {
    const from = normalize(before[field]);
    const to = normalize(after[field]);
    if (JSON.stringify(from) !== JSON.stringify(to))
      changes.push({ field, from: from ?? null, to: to ?? null });
  }
  return changes;
}
