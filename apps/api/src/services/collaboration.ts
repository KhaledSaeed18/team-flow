import { can } from '@teamflow/auth';
import {
  createComment,
  deleteComment,
  findComment,
  findTask,
  listComments,
  listNotifications,
  listReactions,
  markNotificationsRead,
  type Reaction,
  setReaction,
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

/** Comments on a task, each with its reactions grouped by kind in the order they were first given. */
async function commentsWithReactions(actor: Actor, taskId: string) {
  const list = await listComments(actor.scope, taskId);
  const rows = await listReactions(
    actor.scope,
    list.map((c) => c.id),
  );
  const byComment = new Map<string, Map<Reaction, { memberIds: string[]; names: string[] }>>();
  for (const row of rows) {
    const kinds = byComment.get(row.commentId) ?? new Map();
    const group = kinds.get(row.reaction) ?? { memberIds: [], names: [] };
    group.memberIds.push(row.memberId);
    group.names.push(row.name);
    kinds.set(row.reaction, group);
    byComment.set(row.commentId, kinds);
  }
  return list.map((comment) => ({
    ...comment,
    reactions: [...(byComment.get(comment.id) ?? new Map()).entries()].map(
      ([reaction, group]: [Reaction, { memberIds: string[]; names: string[] }]) => ({
        reaction,
        count: group.memberIds.length,
        mine: group.memberIds.includes(actor.member.id),
        names: group.names,
      }),
    ),
  }));
}

async function commentWithAuthor(actor: Actor, taskId: string, id: string) {
  const comment = (await commentsWithReactions(actor, taskId)).find((c) => c.id === id);
  if (!comment) throw notFound('Comment not found.');
  return comment;
}

export const commentsService = {
  async list(actor: Actor, taskId: string) {
    await visibleTask(actor, taskId);
    return commentsWithReactions(actor, taskId);
  },

  /** Anyone who may comment may react, guests included. */
  async react(actor: Actor, input: { commentId: string; reaction: Reaction; on: boolean }) {
    authorize(actor, { comment: ['create'] });
    const comment = await setReaction(actor.scope, { ...input, memberId: actor.member.id });
    if (!comment) throw notFound('Comment not found.');
    return commentWithAuthor(actor, comment.taskId, comment.id);
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
