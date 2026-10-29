import { and, asc, eq } from 'drizzle-orm';
import { attachments } from '../schema/attachments.ts';
import { members, users } from '../schema/auth.ts';
import { inTransaction, type Scope } from '../scope.ts';
import { emit, recordActivity } from './events.ts';

export type AttachmentRow = typeof attachments.$inferSelect;

export function listAttachments(scope: Scope, taskId: string) {
  return scope.db
    .select({
      id: attachments.id,
      fileName: attachments.fileName,
      contentType: attachments.contentType,
      sizeBytes: attachments.sizeBytes,
      storageKey: attachments.storageKey,
      createdAt: attachments.createdAt,
      uploaderMemberId: attachments.uploaderMemberId,
      uploaderName: users.name,
    })
    .from(attachments)
    .leftJoin(
      members,
      and(
        eq(members.organizationId, attachments.organizationId),
        eq(members.id, attachments.uploaderMemberId),
      ),
    )
    .leftJoin(users, eq(users.id, members.userId))
    .where(
      and(eq(attachments.organizationId, scope.organizationId), eq(attachments.taskId, taskId)),
    )
    .orderBy(asc(attachments.createdAt));
}

export async function findAttachment(scope: Scope, id: string): Promise<AttachmentRow | null> {
  const [row] = await scope.db
    .select()
    .from(attachments)
    .where(and(eq(attachments.organizationId, scope.organizationId), eq(attachments.id, id)))
    .limit(1);
  return row ?? null;
}

/** Record a file that has already been stored. */
export function createAttachment(
  scope: Scope,
  input: {
    taskId: string;
    projectId: string;
    fileName: string;
    contentType: string;
    sizeBytes: number;
    storageKey: string;
  },
  now: Date,
) {
  return inTransaction(scope, async (tx) => {
    const { projectId, ...values } = input;
    const [row] = await tx.db
      .insert(attachments)
      .values({
        organizationId: tx.organizationId,
        uploaderMemberId: tx.memberId,
        ...values,
        createdAt: now,
      })
      .returning();
    if (!row) throw new Error('insert returned no row');
    await recordActivity(tx, {
      kind: 'attachment.added',
      projectId,
      taskId: input.taskId,
      changes: [{ field: 'attachment', from: null, to: input.fileName }],
      at: now,
    });
    await emit(tx, 'attachments.changed', { taskId: input.taskId, projectId });
    return row;
  });
}

export function deleteAttachment(scope: Scope, id: string, projectId: string, now: Date) {
  return inTransaction(scope, async (tx) => {
    const [row] = await tx.db
      .delete(attachments)
      .where(and(eq(attachments.organizationId, tx.organizationId), eq(attachments.id, id)))
      .returning();
    if (!row) return null;
    await recordActivity(tx, {
      kind: 'attachment.removed',
      projectId,
      taskId: row.taskId,
      changes: [{ field: 'attachment', from: row.fileName, to: null }],
      at: now,
    });
    await emit(tx, 'attachments.changed', { taskId: row.taskId, projectId });
    return row;
  });
}
