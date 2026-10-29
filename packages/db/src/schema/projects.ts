import { STATUS_CATEGORIES } from '@teamflow/domain';
import { relations, sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { members } from './auth.ts';
import { at, createdAt, tenantColumns, tenantKey, tenantRef, updatedAt } from './tenant.ts';

export const statusCategory = pgEnum('status_category', STATUS_CATEGORIES);

export const projects = pgTable(
  'projects',
  {
    ...tenantColumns(),
    /** Short uppercase prefix for task identifiers: `TF` in `TF-42`. */
    key: text().notNull(),
    name: text().notNull(),
    description: text().notNull().default(''),
    color: text().notNull().default('#6366f1'),
    leadMemberId: uuid(),
    /** Last task number handed out; incremented under a row lock. */
    taskSequence: integer().notNull().default(0),
    version: integer().notNull().default(1),
    archivedAt: at(),
    createdByMemberId: uuid(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    tenantKey(t),
    uniqueIndex().on(t.organizationId, t.key),
    tenantRef(t, t.leadMemberId, members),
    tenantRef(t, t.createdByMemberId, members),
    check('projects_key_format', sql`${t.key} ~ '^[A-Z][A-Z0-9]{1,5}$'`),
  ],
);

export const workflowStatuses = pgTable(
  'workflow_statuses',
  {
    ...tenantColumns(),
    projectId: uuid().notNull(),
    name: text().notNull(),
    category: statusCategory().notNull(),
    color: text().notNull(),
    /** Column order on the board (fractional rank, ADR-0008). */
    rank: text().notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    tenantKey(t),
    tenantRef(t, t.projectId, projects).onDelete('cascade'),
    uniqueIndex('workflow_statuses_name_unique').on(
      t.organizationId,
      t.projectId,
      sql`lower(${t.name})`,
    ),
    index().on(t.organizationId, t.projectId, t.rank),
  ],
);

/** Labels belong to one project, or to the whole organization when `projectId` is null. */
export const labels = pgTable(
  'labels',
  {
    ...tenantColumns(),
    projectId: uuid(),
    name: text().notNull(),
    color: text().notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    tenantKey(t),
    tenantRef(t, t.projectId, projects).onDelete('cascade'),
    uniqueIndex('labels_name_unique').on(
      t.organizationId,
      sql`coalesce(${t.projectId}, '00000000-0000-0000-0000-000000000000')`,
      sql`lower(${t.name})`,
    ),
  ],
);

export const projectsRelations = relations(projects, ({ many, one }) => ({
  statuses: many(workflowStatuses),
  labels: many(labels),
  lead: one(members, { fields: [projects.leadMemberId], references: [members.id] }),
}));

export const workflowStatusesRelations = relations(workflowStatuses, ({ one }) => ({
  project: one(projects, { fields: [workflowStatuses.projectId], references: [projects.id] }),
}));

export const labelsRelations = relations(labels, ({ one }) => ({
  project: one(projects, { fields: [labels.projectId], references: [projects.id] }),
}));
