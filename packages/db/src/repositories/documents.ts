import { and, eq } from 'drizzle-orm';
import { taskDocuments } from '../schema/documents.ts';
import type { Scope } from '../scope.ts';

export async function loadTaskDocument(scope: Scope, taskId: string): Promise<Uint8Array | null> {
  const [row] = await scope.db
    .select({ state: taskDocuments.state })
    .from(taskDocuments)
    .where(
      and(eq(taskDocuments.organizationId, scope.organizationId), eq(taskDocuments.taskId, taskId)),
    )
    .limit(1);
  return row?.state ?? null;
}

/** Store the merged document state (an upsert; Yjs state is the whole document, not a delta). */
export async function saveTaskDocument(
  scope: Scope,
  taskId: string,
  state: Uint8Array,
): Promise<void> {
  await scope.db
    .insert(taskDocuments)
    .values({ organizationId: scope.organizationId, taskId, state })
    .onConflictDoUpdate({
      target: [taskDocuments.organizationId, taskDocuments.taskId],
      set: { state, updatedAt: new Date() },
    });
}
