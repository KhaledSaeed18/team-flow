import { bigint, index, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { members } from './auth.ts';
import { tasks } from './tasks.ts';
import { createdAt, tenantColumns, tenantKey, tenantRef } from './tenant.ts';

/** A file attached to a task. The bytes live in object storage under `storageKey`. */
export const attachments = pgTable(
  'attachments',
  {
    ...tenantColumns(),
    taskId: uuid().notNull(),
    uploaderMemberId: uuid(),
    fileName: text().notNull(),
    contentType: text().notNull(),
    sizeBytes: bigint({ mode: 'number' }).notNull(),
    storageKey: text().notNull().unique(),
    createdAt: createdAt(),
  },
  (t) => [
    tenantKey(t),
    tenantRef(t, t.taskId, tasks).onDelete('cascade'),
    tenantRef(t, t.uploaderMemberId, members),
    index('attachments_task_idx').on(t.organizationId, t.taskId, t.createdAt),
  ],
);
