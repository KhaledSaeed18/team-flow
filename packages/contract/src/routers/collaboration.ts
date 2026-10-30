import { DigestFrequency } from '@teamflow/domain';
import { z } from 'zod';
import { base } from '../base.ts';
import { Flag, Id, Timestamp } from '../schemas.ts';

export const REACTIONS = ['thumbsup', 'tada', 'heart', 'smile', 'eyes', 'rocket'] as const;
export const Reaction = z.enum(REACTIONS);
export type Reaction = z.infer<typeof Reaction>;

export const ReactionSummary = z.object({
  reaction: Reaction,
  count: z.number().int().positive(),
  /** Whether the caller is among them. */
  mine: z.boolean(),
  /** Who reacted, in order. */
  names: z.array(z.string()),
});

export const Comment = z.object({
  id: Id,
  taskId: Id,
  body: z.string(),
  mentions: z.array(Id),
  authorMemberId: Id.nullable(),
  authorName: z.string().nullable(),
  authorImage: z.string().nullable(),
  createdAt: Timestamp,
  editedAt: Timestamp.nullable(),
  reactions: z.array(ReactionSummary),
});
export type Comment = z.infer<typeof Comment>;

export const Notification = z.object({
  id: Id,
  kind: z.enum(['assigned', 'mentioned', 'commented']),
  taskId: Id.nullable(),
  commentId: Id.nullable(),
  data: z.record(z.string(), z.string()),
  readAt: Timestamp.nullable(),
  createdAt: Timestamp,
  actorName: z.string().nullable(),
  actorImage: z.string().nullable(),
});
export type Notification = z.infer<typeof Notification>;

const Body = z.string().trim().min(1).max(10_000);
const Mentions = z.array(Id).max(50).default([]);
const errors = {
  INVALID_REFERENCE: { status: 422, message: 'Something this refers to does not fit here.' },
};

export const comments = {
  list: base
    .route({
      method: 'GET',
      path: '/tasks/{taskId}/comments',
      summary: 'Comments on a task',
      tags: ['Comments'],
    })
    .input(z.object({ taskId: Id }))
    .output(z.array(Comment)),

  create: base
    .route({
      method: 'POST',
      path: '/tasks/{taskId}/comments',
      summary: 'Comment on a task',
      tags: ['Comments'],
      successStatus: 201,
    })
    .errors(errors)
    .input(z.object({ taskId: Id, body: Body, mentions: Mentions }))
    .output(Comment),

  update: base
    .route({
      method: 'PATCH',
      path: '/comments/{id}',
      summary: 'Edit your comment',
      tags: ['Comments'],
    })
    .errors(errors)
    .input(z.object({ id: Id, body: Body, mentions: Mentions }))
    .output(Comment),

  delete: base
    .route({
      method: 'DELETE',
      path: '/comments/{id}',
      summary: 'Delete a comment',
      tags: ['Comments'],
    })
    .input(z.object({ id: Id }))
    .output(z.object({ id: Id })),

  react: base
    .route({
      method: 'PUT',
      path: '/comments/{commentId}/reactions/{reaction}',
      summary: 'Add or remove your reaction',
      tags: ['Comments'],
    })
    .input(z.object({ commentId: Id, reaction: Reaction, on: z.boolean() }))
    .output(Comment),
};

export const notifications = {
  list: base
    .route({
      method: 'GET',
      path: '/notifications',
      summary: 'Your notifications, newest first',
      tags: ['Notifications'],
    })
    .input(z.object({ unreadOnly: Flag.default(false) }).default({ unreadOnly: false }))
    .output(z.object({ items: z.array(Notification), unread: z.number().int() })),

  markRead: base
    .route({
      method: 'POST',
      path: '/notifications/read',
      summary: 'Mark notifications read',
      tags: ['Notifications'],
    })
    .input(z.object({ ids: z.array(Id).max(200).nullable() }))
    .output(z.object({ unread: z.number().int() })),

  digest: base
    .route({
      method: 'GET',
      path: '/me/digest',
      summary: 'How often you get an email summary of unread notifications',
      tags: ['Notifications'],
    })
    .output(z.object({ frequency: DigestFrequency })),

  setDigest: base
    .route({
      method: 'PUT',
      path: '/me/digest',
      summary: 'Change how often you get an email summary',
      tags: ['Notifications'],
    })
    .input(z.object({ frequency: DigestFrequency }))
    .output(z.object({ frequency: DigestFrequency })),
};
