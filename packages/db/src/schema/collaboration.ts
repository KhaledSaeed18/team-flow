import { relations, sql } from 'drizzle-orm';
import { index, jsonb, pgEnum, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { members } from './auth.ts';
import { tasks } from './tasks.ts';
import { at, createdAt, tenantColumns, tenantKey, tenantRef } from './tenant.ts';

export const comments = pgTable(
  'comments',
  {
    ...tenantColumns(),
    taskId: uuid().notNull(),
    authorMemberId: uuid(),
    body: text().notNull(),
    /** Members mentioned in the body, validated on write. */
    mentions: uuid().array().notNull().default(sql`'{}'::uuid[]`),
    createdAt: createdAt(),
    editedAt: at(),
    deletedAt: at(),
  },
  (t) => [
    tenantKey(t),
    tenantRef(t, t.taskId, tasks).onDelete('cascade'),
    tenantRef(t, t.authorMemberId, members),
    index('comments_task_idx').on(t.organizationId, t.taskId, t.createdAt),
  ],
);

export const REACTIONS = ['thumbsup', 'tada', 'heart', 'smile', 'eyes', 'rocket'] as const;
export const reactionKind = pgEnum('reaction', REACTIONS);

/** One person's reaction to a comment; at most one of each kind per person. */
export const commentReactions = pgTable(
  'comment_reactions',
  {
    ...tenantColumns(),
    commentId: uuid().notNull(),
    memberId: uuid().notNull(),
    reaction: reactionKind().notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    tenantKey(t),
    tenantRef(t, t.commentId, comments).onDelete('cascade'),
    tenantRef(t, t.memberId, members).onDelete('cascade'),
    uniqueIndex('comment_reactions_unique').on(
      t.organizationId,
      t.commentId,
      t.memberId,
      t.reaction,
    ),
  ],
);

export const NOTIFICATION_KINDS = ['assigned', 'mentioned', 'commented'] as const;
export const notificationKind = pgEnum('notification_kind', NOTIFICATION_KINDS);

/** An in-app notification for one member. Created in the same transaction as the change that caused it. */
export const notifications = pgTable(
  'notifications',
  {
    ...tenantColumns(),
    recipientMemberId: uuid().notNull(),
    actorMemberId: uuid(),
    kind: notificationKind().notNull(),
    taskId: uuid(),
    commentId: uuid(),
    /** Denormalised for rendering without joins: task identifier and title, comment excerpt. */
    data: jsonb().$type<Record<string, string>>().notNull().default({}),
    readAt: at(),
    createdAt: createdAt(),
  },
  (t) => [
    tenantKey(t),
    tenantRef(t, t.recipientMemberId, members).onDelete('cascade'),
    tenantRef(t, t.actorMemberId, members),
    tenantRef(t, t.taskId, tasks).onDelete('cascade'),
    tenantRef(t, t.commentId, comments).onDelete('cascade'),
    index('notifications_inbox_idx').on(t.organizationId, t.recipientMemberId, t.createdAt),
    index('notifications_unread_idx')
      .on(t.organizationId, t.recipientMemberId)
      .where(sql`${t.readAt} is null`),
  ],
);

export const commentsRelations = relations(comments, ({ one }) => ({
  task: one(tasks, { fields: [comments.taskId], references: [tasks.id] }),
  author: one(members, { fields: [comments.authorMemberId], references: [members.id] }),
}));
