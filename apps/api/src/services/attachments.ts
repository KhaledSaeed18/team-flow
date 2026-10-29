import { can } from '@teamflow/auth';
import {
  createAttachment,
  deleteAttachment,
  findAttachment,
  findTask,
  listAttachments,
  newId,
} from '@teamflow/db';
import { AppError, notFound } from '../errors.ts';
import type { Storage } from '../storage.ts';
import { type Actor, authorize } from './actor.ts';

/** A safe display name: no path, no control characters, bounded length. */
export const cleanFileName = (name: string) =>
  (name.split(/[\\/]/).pop() ?? 'file')
    .split('')
    .filter((char) => char.charCodeAt(0) > 31 && char.charCodeAt(0) !== 127)
    .join('')
    .trim()
    .slice(0, 200) || 'file';

/** Your own uploads, while you can still edit tasks. */
const mayRemoveOwn = (actor: Actor, uploaderMemberId: string | null) =>
  uploaderMemberId === actor.member.id && can(actor.member.role, { task: ['update'] });

export function attachmentsService(storage: Storage) {
  return {
    async list(actor: Actor, taskId: string) {
      if (!(await findTask(actor.scope, taskId))) throw notFound('Task not found.');
      const rows = await listAttachments(actor.scope, taskId);
      const deleteAny = can(actor.member.role, { task: ['delete'] });
      return rows.map(({ storageKey, uploaderMemberId, ...row }) => ({
        ...row,
        url: storage.url(storageKey, row.fileName),
        canDelete: deleteAny || mayRemoveOwn(actor, uploaderMemberId),
      }));
    },

    async upload(
      actor: Actor,
      input: { taskId: string; fileName: string; contentType: string; body: ArrayBuffer },
      now: Date,
    ) {
      const task = await findTask(actor.scope, input.taskId);
      if (!task) throw notFound('Task not found.');
      authorize(actor, { task: ['update'] });
      if (input.body.byteLength === 0) throw new AppError('BAD_REQUEST', 'The file is empty.');

      const fileName = cleanFileName(input.fileName);
      // Keys are opaque and namespaced by organization; the file name never reaches the key.
      const storageKey = `${actor.scope.organizationId}/${task.id}/${newId()}`;
      await storage.put(storageKey, input.body, { contentType: input.contentType, fileName });
      try {
        const row = await createAttachment(
          actor.scope,
          {
            taskId: task.id,
            projectId: task.projectId,
            fileName,
            contentType: input.contentType,
            sizeBytes: input.body.byteLength,
            storageKey,
          },
          now,
        );
        return { id: row.id, fileName: row.fileName, sizeBytes: row.sizeBytes };
      } catch (error) {
        await storage.remove(storageKey).catch(() => {});
        throw error;
      }
    },

    async delete(actor: Actor, id: string, now: Date) {
      const attachment = await findAttachment(actor.scope, id);
      if (!attachment) throw notFound('Attachment not found.');
      const task = await findTask(actor.scope, attachment.taskId);
      if (!task) throw notFound('Attachment not found.');
      if (!mayRemoveOwn(actor, attachment.uploaderMemberId)) authorize(actor, { task: ['delete'] });
      await deleteAttachment(actor.scope, id, task.projectId, now);
      await storage.remove(attachment.storageKey).catch(() => {});
      return { id };
    },
  };
}
