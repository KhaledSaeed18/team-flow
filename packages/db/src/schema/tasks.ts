import { PRIORITIES, RELATION_TYPES } from '@teamflow/domain';
import { relations, sql } from 'drizzle-orm';
import {
  check,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { members, organizations } from './auth.ts';
import { labels, projects, workflowStatuses } from './projects.ts';
import { sprints } from './sprints.ts';
import { at, createdAt, tenantColumns, tenantKey, tenantRef, updatedAt } from './tenant.ts';

export const taskPriority = pgEnum('task_priority', PRIORITIES);
export const taskRelationType = pgEnum('task_relation_type', RELATION_TYPES);

export const tasks = pgTable(
  'tasks',
  {
    ...tenantColumns(),
    projectId: uuid().notNull(),
    /** Per-project sequence number: the `42` in `TF-42`. */
    number: integer().notNull(),
    title: text().notNull(),
    /** Plain-text projection of the description, used for search and previews. */
    description: text().notNull().default(''),
    statusId: uuid().notNull(),
    priority: taskPriority().notNull().default('none'),
    estimate: integer(),
    assigneeMemberId: uuid(),
    parentTaskId: uuid(),
    sprintId: uuid(),
    dueDate: date({ mode: 'string' }),
    /** Order within its status column and in the backlog (fractional rank, ADR-0008). */
    rank: text().notNull(),
    startedAt: at(),
    completedAt: at(),
    canceledAt: at(),
    createdByMemberId: uuid(),
    version: integer().notNull().default(1),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: at(),
  },
  (t) => [
    tenantKey(t),
    uniqueIndex().on(t.organizationId, t.projectId, t.number),
    tenantRef(t, t.projectId, projects).onDelete('cascade'),
    // Composite through project_id too: a task's status must belong to the task's own project.
    foreignKey({
      name: 'tasks_status_in_project_fk',
      columns: [t.organizationId, t.projectId, t.statusId],
      foreignColumns: [
        workflowStatuses.organizationId,
        workflowStatuses.projectId,
        workflowStatuses.id,
      ],
    }),
    tenantRef(t, t.assigneeMemberId, members),
    // A task's sprint must be a sprint of the task's own project.
    foreignKey({
      name: 'tasks_sprint_in_project_fk',
      columns: [t.organizationId, t.projectId, t.sprintId],
      foreignColumns: [sprints.organizationId, sprints.projectId, sprints.id],
    }),
    index('tasks_sprint_idx').on(t.organizationId, t.sprintId).where(sql`${t.deletedAt} is null`),
    tenantRef(t, t.createdByMemberId, members),
    tenantRef(t, t.parentTaskId, t).onDelete('cascade'),
    index('tasks_board_idx')
      .on(t.organizationId, t.projectId, t.statusId, t.rank)
      .where(sql`${t.deletedAt} is null`),
    index('tasks_assignee_idx')
      .on(t.organizationId, t.assigneeMemberId)
      .where(sql`${t.deletedAt} is null`),
    index('tasks_parent_idx').on(t.organizationId, t.parentTaskId),
    check('tasks_estimate_range', sql`${t.estimate} is null or ${t.estimate} between 0 and 100`),
    check('tasks_not_own_parent', sql`${t.parentTaskId} is distinct from ${t.id}`),
  ],
);

export const taskLabels = pgTable(
  'task_labels',
  {
    organizationId: uuid()
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    taskId: uuid().notNull(),
    labelId: uuid().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.organizationId, t.taskId, t.labelId] }),
    tenantRef(t, t.taskId, tasks).onDelete('cascade'),
    tenantRef(t, t.labelId, labels).onDelete('cascade'),
    index().on(t.organizationId, t.labelId),
  ],
);

export const taskRelations = pgTable(
  'task_relations',
  {
    ...tenantColumns(),
    type: taskRelationType().notNull(),
    sourceTaskId: uuid().notNull(),
    targetTaskId: uuid().notNull(),
    createdByMemberId: uuid(),
    createdAt: createdAt(),
  },
  (t) => [
    tenantKey(t),
    tenantRef(t, t.sourceTaskId, tasks).onDelete('cascade'),
    tenantRef(t, t.targetTaskId, tasks).onDelete('cascade'),
    tenantRef(t, t.createdByMemberId, members),
    uniqueIndex().on(t.organizationId, t.sourceTaskId, t.targetTaskId, t.type),
    index().on(t.organizationId, t.targetTaskId),
    check('task_relations_not_self', sql`${t.sourceTaskId} <> ${t.targetTaskId}`),
  ],
);

export interface FieldChange {
  field: string;
  from: unknown;
  to: unknown;
}

/**
 * Append-only history of everything that happened (ADR-0007). Never updated or deleted; task history, audit views
 * and every sprint metric are computed from it.
 */
export const activity = pgTable(
  'activity',
  {
    ...tenantColumns(),
    projectId: uuid(),
    taskId: uuid(),
    actorMemberId: uuid(),
    /** What happened, e.g. `task.created`, `task.updated`, `project.archived`. */
    kind: text().notNull(),
    changes: jsonb().$type<FieldChange[]>().notNull().default([]),
    createdAt: createdAt(),
  },
  (t) => [
    tenantKey(t),
    tenantRef(t, t.projectId, projects).onDelete('cascade'),
    tenantRef(t, t.taskId, tasks).onDelete('cascade'),
    tenantRef(t, t.actorMemberId, members),
    index('activity_task_idx').on(t.organizationId, t.taskId, t.createdAt),
    index('activity_project_idx').on(t.organizationId, t.projectId, t.createdAt),
  ],
);

/**
 * Domain events written in the same transaction as the change they describe, then published by the relay
 * (ADR-0007). `id` is a UUID v7, so ordering by id is ordering by creation.
 */
export const outbox = pgTable(
  'outbox',
  {
    ...tenantColumns(),
    topic: text().notNull(),
    payload: jsonb().$type<Record<string, unknown>>().notNull(),
    createdAt: createdAt(),
    publishedAt: at(),
  },
  (t) => [tenantKey(t), index('outbox_pending_idx').on(t.id).where(sql`${t.publishedAt} is null`)],
);

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  project: one(projects, { fields: [tasks.projectId], references: [projects.id] }),
  status: one(workflowStatuses, { fields: [tasks.statusId], references: [workflowStatuses.id] }),
  assignee: one(members, { fields: [tasks.assigneeMemberId], references: [members.id] }),
  parent: one(tasks, {
    fields: [tasks.parentTaskId],
    references: [tasks.id],
    relationName: 'subtasks',
  }),
  subtasks: many(tasks, { relationName: 'subtasks' }),
  labels: many(taskLabels),
}));

export const taskLabelsRelations = relations(taskLabels, ({ one }) => ({
  task: one(tasks, { fields: [taskLabels.taskId], references: [tasks.id] }),
  label: one(labels, { fields: [taskLabels.labelId], references: [labels.id] }),
}));
