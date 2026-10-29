import { can } from '@teamflow/auth';
import {
  createComment,
  deleteComment,
  findComment,
  findTask,
  listComments,
  listNotifications,
  markNotificationsRead,
  unreadCount,
  updateComment,
} from '@teamflow/db';
import { forbidden, notFound } from '../errors.ts';
import { type Actor, authorize } from './actor.ts';

async function visibleTask(actor: Actor, taskId: string) {
  const task = await findTask(actor.scope, taskId);
  if (!task) throw notFound('Task not found.');
  return task;
}

async function commentWithAuthor(actor: Actor, taskId: string, id: string) {
  const comment = (await listComments(actor.scope, taskId)).find((c) => c.id === id);
  if (!comment) throw notFound('Comment not found.');
  return comment;
}

export const commentsService = {
  async list(actor: Actor, taskId: string) {
    await visibleTask(actor, taskId);
    return listComments(actor.scope, taskId);
  },

  async create(
    actor: Actor,
    input: { taskId: string; body: string; mentions: string[] },
    now: Date,
  ) {
    await visibleTask(actor, input.taskId);
    authorize(actor, { comment: ['create'] });
    const comment = await createComment(actor.scope, input, now);
    if (!comment) throw notFound('Task not found.');
    return commentWithAuthor(actor, input.taskId, comment.id);
  },

  async update(actor: Actor, id: string, input: { body: string; mentions: string[] }, now: Date) {
    const comment = await findComment(actor.scope, id);
    if (!comment) throw notFound('Comment not found.');
    // Only the author edits their words; moderators may delete but not rewrite them.
    if (comment.authorMemberId !== actor.member.id) throw forbidden();
    const updated = await updateComment(actor.scope, id, input, now);
    if (!updated) throw notFound('Comment not found.');
    return commentWithAuthor(actor, updated.taskId, id);
  },

  async delete(actor: Actor, id: string, now: Date) {
    const comment = await findComment(actor.scope, id);
    if (!comment) throw notFound('Comment not found.');
    const own = comment.authorMemberId === actor.member.id;
    if (!own && !can(actor.member.role, { comment: ['moderate'] })) throw forbidden();
    await deleteComment(actor.scope, id, now);
    return { id };
  },
};

export const notificationsService = {
  async list(actor: Actor, unreadOnly: boolean) {
    const [items, unread] = await Promise.all([
      listNotifications(actor.scope, actor.member.id, { unreadOnly }),
      unreadCount(actor.scope, actor.member.id),
    ]);
    return { items, unread };
  },

  async markRead(actor: Actor, ids: string[] | null, now: Date) {
    await markNotificationsRead(actor.scope, actor.member.id, ids, now);
    return { unread: await unreadCount(actor.scope, actor.member.id) };
  },
};
