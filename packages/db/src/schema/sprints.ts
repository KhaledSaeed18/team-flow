import { relations, sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { projects } from './projects.ts';
import { at, createdAt, tenantColumns, tenantKey, tenantRef, updatedAt } from './tenant.ts';

export const SPRINT_STATUSES = ['planned', 'active', 'completed'] as const;
export const sprintStatus = pgEnum('sprint_status', SPRINT_STATUSES);

export const sprints = pgTable(
  'sprints',
  {
    ...tenantColumns(),
    projectId: uuid().notNull(),
    name: text().notNull(),
    goal: text().notNull().default(''),
    status: sprintStatus().notNull().default('planned'),
    startsAt: at().notNull(),
    endsAt: at().notNull(),
    startedAt: at(),
    completedAt: at(),
    /** Frozen when the sprint completes, for velocity. */
    committedPoints: integer(),
    completedPoints: integer(),
    version: integer().notNull().default(1),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    tenantKey(t),
    /** Target for tasks' (organization_id, project_id, sprint_id) key: a sprint of the task's own project. */
    unique('sprints_project_key').on(t.organizationId, t.projectId, t.id),
    tenantRef(t, t.projectId, projects).onDelete('cascade'),
    uniqueIndex('sprints_one_active_per_project')
      .on(t.organizationId, t.projectId)
      .where(sql`${t.status} = 'active'`),
    index().on(t.organizationId, t.projectId, t.startsAt),
    check('sprints_dates', sql`${t.endsAt} > ${t.startsAt}`),
  ],
);

export const sprintsRelations = relations(sprints, ({ one }) => ({
  project: one(projects, { fields: [sprints.projectId], references: [projects.id] }),
}));
