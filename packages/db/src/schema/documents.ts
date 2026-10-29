import { customType, pgTable, primaryKey, uuid } from 'drizzle-orm/pg-core';
import { organizations } from './auth.ts';
import { tasks } from './tasks.ts';
import { tenantRef, updatedAt } from './tenant.ts';

const bytea = customType<{ data: Uint8Array; driverData: Buffer }>({
  dataType: () => 'bytea',
  toDriver: (value) => Buffer.from(value),
  fromDriver: (value) => new Uint8Array(value),
});

/**
 * The collaborative description of a task: the merged Yjs document state. The plain-text projection lives in
 * `tasks.description` for search, previews and history.
 */
export const taskDocuments = pgTable(
  'task_documents',
  {
    organizationId: uuid()
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    taskId: uuid().notNull(),
    state: bytea().notNull(),
    updatedAt: updatedAt(),
  },
  (t) => [
    primaryKey({ columns: [t.organizationId, t.taskId] }),
    tenantRef(t, t.taskId, tasks).onDelete('cascade'),
  ],
);
