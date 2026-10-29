import { taskIdentifier } from '@teamflow/domain';
import { and, asc, count, desc, eq, inArray, isNotNull, isNull, ne, sql } from 'drizzle-orm';
import { members, users } from '../schema/auth.ts';
import {
  commentReactions,
  comments,
  notifications,
  type REACTIONS,
} from '../schema/collaboration.ts';
import { projects } from '../schema/projects.ts';
import { tasks } from '../schema/tasks.ts';
import { inTransaction, type Scope } from '../scope.ts';
import { emit, recordActivity } from './events.ts';
import { InvalidReferenceError } from './tasks.ts';

export type CommentRow = typeof comments.$inferSelect;
export type NotificationKind = (typeof notifications.$inferInsert)['kind'];
export type Reaction = (typeof REACTIONS)[number];

const excerpt = (body: string) => (body.length > 140 ? `${body.slice(0, 137)}…` : body);

/** Task facts notifications are rendered from, without joins at read time. */
async function taskSummary(tx: Scope, taskId: string) {
  const [row] = await tx.db
    .select({
      id: tasks.id,
      projectId: tasks.projectId,
      number: tasks.number,
      title: tasks.title,
      key: projects.key,
      createdByMemberId: tasks.createdByMemberId,
      assigneeMemberId: tasks.assigneeMemberId,
    })
    .from(tasks)
    .innerJoin(
      projects,
      and(eq(projects.organizationId, tasks.organizationId), eq(projects.id, tasks.projectId)),
    )
    .where(
      and(
        eq(tasks.organizationId, tx.organizationId),
        eq(tasks.id, taskId),
        isNull(tasks.deletedAt),
      ),
    )
    .limit(1);
  return row ? { ...row, identifier: taskIdentifier(row.key, row.number) } : null;
}

/**
 * Insert notifications for `recipients` (never the actor) and announce them on each recipient's channel.
 * Call inside the transaction of the change that caused them.
 */
export async function notify(
  tx: Scope,
  recipients: Iterable<string>,
  kind: NotificationKind,
  input: { taskId: string; commentId?: string; data: Record<string, string> },
) {
  const ids = [...new Set(recipients)].filter((id) => id !== tx.memberId);
  if (ids.length === 0) return;
  await tx.db.insert(notifications).values(
    ids.map((recipientMemberId) => ({
      organizationId: tx.organizationId,
      recipientMemberId,
      actorMemberId: tx.memberId,
      kind,
      taskId: input.taskId,
      commentId: input.commentId ?? null,
      data: input.data,
    })),
  );
  await emit(tx, 'notifications.created', { recipientMemberIds: ids, kind, taskId: input.taskId });
}

/** Notify a newly assigned member. Used by task create/update. */
export async function notifyAssigned(tx: Scope, taskId: string, assigneeMemberId: string | null) {
  if (!assigneeMemberId) return;
  const task = await taskSummary(tx, taskId);
  if (!task) return;
  await notify(tx, [assigneeMemberId], 'assigned', {
    taskId,
    data: { identifier: task.identifier, title: task.title },
  });
}

export function listComments(scope: Scope, taskId: string) {
  return scope.db
    .select({
      id: comments.id,
      taskId: comments.taskId,
      body: comments.body,
      mentions: comments.mentions,
      authorMemberId: comments.authorMemberId,
      authorName: users.name,
      authorImage: users.image,
      createdAt: comments.createdAt,
      editedAt: comments.editedAt,
    })
    .from(comments)
    .leftJoin(
      members,
      and(
        eq(members.organizationId, comments.organizationId),
        eq(members.id, comments.authorMemberId),
      ),
    )
    .leftJoin(users, eq(users.id, members.userId))
    .where(
      and(
        eq(comments.organizationId, scope.organizationId),
        eq(comments.taskId, taskId),
        isNull(comments.deletedAt),
      ),
    )
    .orderBy(asc(comments.createdAt), asc(comments.id));
}

export async function findComment(scope: Scope, id: string): Promise<CommentRow | null> {
  const [row] = await scope.db
    .select()
    .from(comments)
    .where(
      and(
        eq(comments.organizationId, scope.organizationId),
        eq(comments.id, id),
        isNull(comments.deletedAt),
      ),
    )
    .limit(1);
  return row ?? null;
}

async function assertMembers(tx: Scope, memberIds: string[]) {
  if (memberIds.length === 0) return;
  const [found] = await tx.db
    .select({ n: count() })
    .from(members)
    .where(and(eq(members.organizationId, tx.organizationId), inArray(members.id, memberIds)));
  if ((found?.n ?? 0) !== new Set(memberIds).size) {
    throw new InvalidReferenceError('Only members of this workspace can be mentioned.');
  }
}

export function createComment(
  scope: Scope,
  input: { taskId: string; body: string; mentions: string[] },
  now: Date,
) {
  return inTransaction(scope, async (tx) => {
    const task = await taskSummary(tx, input.taskId);
    if (!task) return null;
    const mentions = [...new Set(input.mentions)];
    await assertMembers(tx, mentions);

    const [comment] = await tx.db
      .insert(comments)
      .values({
        organizationId: tx.organizationId,
        taskId: input.taskId,
        authorMemberId: tx.memberId,
        body: input.body,
        mentions,
        createdAt: now,
      })
      .returning();
    if (!comment) throw new Error('insert returned no row');

    // Everyone involved hears about it: whoever created or is assigned the task, and earlier commenters.
    const earlier = await tx.db
      .selectDistinct({ id: comments.authorMemberId })
      .from(comments)
      .where(
        and(
          eq(comments.organizationId, tx.organizationId),
          eq(comments.taskId, input.taskId),
          ne(comments.id, comment.id),
          isNotNull(comments.authorMemberId),
        ),
      );
    const involved = [
      task.createdByMemberId,
      task.assigneeMemberId,
      ...earlier.map((e) => e.id),
    ].filter((id): id is string => id !== null && !mentions.includes(id));
    const data = { identifier: task.identifier, title: task.title, excerpt: excerpt(input.body) };
    await notify(tx, mentions, 'mentioned', { taskId: input.taskId, commentId: comment.id, data });
    await notify(tx, involved, 'commented', { taskId: input.taskId, commentId: comment.id, data });

    await recordActivity(tx, {
      kind: 'comment.created',
      projectId: task.projectId,
      taskId: input.taskId,
      at: now,
    });
    await emit(tx, 'comment.created', {
      taskId: input.taskId,
      projectId: task.projectId,
      commentId: comment.id,
    });
    return comment;
  });
}

export function updateComment(
  scope: Scope,
  id: string,
  input: { body: string; mentions: string[] },
  now: Date,
) {
  return inTransaction(scope, async (tx) => {
    const current = await findComment(tx, id);
    if (!current) return null;
    const mentions = [...new Set(input.mentions)];
    await assertMembers(tx, mentions);
    const [comment] = await tx.db
      .update(comments)
      .set({ body: input.body, mentions, editedAt: now })
      .where(and(eq(comments.organizationId, tx.organizationId), eq(comments.id, id)))
      .returning();
    if (!comment) return null;

    const added = mentions.filter((m) => !current.mentions.includes(m));
    const task = await taskSummary(tx, comment.taskId);
    if (task && added.length > 0) {
      await notify(tx, added, 'mentioned', {
        taskId: comment.taskId,
        commentId: comment.id,
        data: { identifier: task.identifier, title: task.title, excerpt: excerpt(input.body) },
      });
    }
    await emit(tx, 'comment.updated', {
      taskId: comment.taskId,
      projectId: task?.projectId,
      commentId: id,
    });
    return comment;
  });
}

export function deleteComment(scope: Scope, id: string, now: Date) {
  return inTransaction(scope, async (tx) => {
    const [comment] = await tx.db
      .update(comments)
      .set({ deletedAt: now })
      .where(
        and(
          eq(comments.organizationId, tx.organizationId),
          eq(comments.id, id),
          isNull(comments.deletedAt),
        ),
      )
      .returning();
    if (!comment) return null;
    const task = await taskSummary(tx, comment.taskId);
    await emit(tx, 'comment.deleted', {
      taskId: comment.taskId,
      projectId: task?.projectId,
      commentId: id,
    });
    return comment;
  });
}

/** The scope's member's inbox, newest first. */
export function listNotifications(
  scope: Scope,
  memberId: string,
  { unreadOnly = false, limit = 50 } = {},
) {
  return scope.db
    .select({
      id: notifications.id,
      kind: notifications.kind,
      taskId: notifications.taskId,
      commentId: notifications.commentId,
      data: notifications.data,
      readAt: notifications.readAt,
      createdAt: notifications.createdAt,
      actorName: users.name,
      actorImage: users.image,
    })
    .from(notifications)
    .leftJoin(
      members,
      and(
        eq(members.organizationId, notifications.organizationId),
        eq(members.id, notifications.actorMemberId),
      ),
    )
    .leftJoin(users, eq(users.id, members.userId))
    .where(
      and(
        eq(notifications.organizationId, scope.organizationId),
        eq(notifications.recipientMemberId, memberId),
        unreadOnly ? isNull(notifications.readAt) : undefined,
      ),
    )
    .orderBy(desc(notifications.createdAt), desc(notifications.id))
    .limit(limit);
}

export async function unreadCount(scope: Scope, memberId: string): Promise<number> {
  const [row] = await scope.db
    .select({ n: count() })
    .from(notifications)
    .where(
      and(
        eq(notifications.organizationId, scope.organizationId),
        eq(notifications.recipientMemberId, memberId),
        isNull(notifications.readAt),
      ),
    );
  return row?.n ?? 0;
}

/** Mark some (or, with `ids` null, all) of a member's notifications read. Only their own. */
export async function markNotificationsRead(
  scope: Scope,
  memberId: string,
  ids: string[] | null,
  now: Date,
) {
  const rows = await scope.db
    .update(notifications)
    .set({ readAt: now })
    .where(
      and(
        eq(notifications.organizationId, scope.organizationId),
        eq(notifications.recipientMemberId, memberId),
        isNull(notifications.readAt),
        ids ? inArray(notifications.id, ids) : sql`true`,
      ),
    )
    .returning({ id: notifications.id });
  return rows.length;
}

/** Every reaction on these comments, oldest first, with who reacted. */
export function listReactions(scope: Scope, commentIds: string[]) {
  if (commentIds.length === 0) return Promise.resolve([]);
  return scope.db
    .select({
      commentId: commentReactions.commentId,
      reaction: commentReactions.reaction,
      memberId: commentReactions.memberId,
      name: users.name,
    })
    .from(commentReactions)
    .innerJoin(
      members,
      and(
        eq(members.organizationId, commentReactions.organizationId),
        eq(members.id, commentReactions.memberId),
      ),
    )
    .innerJoin(users, eq(users.id, members.userId))
    .where(
      and(
        eq(commentReactions.organizationId, scope.organizationId),
        inArray(commentReactions.commentId, commentIds),
      ),
    )
    .orderBy(asc(commentReactions.createdAt), asc(commentReactions.id));
}

/** Add or remove one reaction. Idempotent both ways; announces the change only when something changed. */
export function setReaction(
  scope: Scope,
  input: { commentId: string; memberId: string; reaction: Reaction; on: boolean },
) {
  return inTransaction(scope, async (tx) => {
    const comment = await findComment(tx, input.commentId);
    if (!comment) return null;
    const changed = input.on
      ? await tx.db
          .insert(commentReactions)
          .values({
            organizationId: tx.organizationId,
            commentId: input.commentId,
            memberId: input.memberId,
            reaction: input.reaction,
          })
          .onConflictDoNothing()
          .returning({ id: commentReactions.id })
      : await tx.db
          .delete(commentReactions)
          .where(
            and(
              eq(commentReactions.organizationId, tx.organizationId),
              eq(commentReactions.commentId, input.commentId),
              eq(commentReactions.memberId, input.memberId),
              eq(commentReactions.reaction, input.reaction),
            ),
          )
          .returning({ id: commentReactions.id });
    if (changed.length > 0) {
      const task = await taskSummary(tx, comment.taskId);
      await emit(tx, 'comment.updated', {
        taskId: comment.taskId,
        projectId: task?.projectId,
        commentId: comment.id,
      });
    }
    return comment;
  });
}
