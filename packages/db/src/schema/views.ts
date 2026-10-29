import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { members } from './auth.ts';
import { projects } from './projects.ts';
import { createdAt, tenantColumns, tenantKey, tenantRef, updatedAt } from './tenant.ts';

/**
 * A named list filter and sort in one project. Private to its owner unless `shared`. The filter is opaque here;
 * the contract validates its shape. Views leave with their owner.
 */
export const savedViews = pgTable(
  'saved_views',
  {
    ...tenantColumns(),
    projectId: uuid().notNull(),
    ownerMemberId: uuid().notNull(),
    name: text().notNull(),
    shared: boolean().notNull().default(false),
    filter: jsonb().$type<Record<string, unknown>>().notNull().default({}),
    sort: text(),
    direction: text(),
    version: integer().notNull().default(1),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    tenantKey(t),
    tenantRef(t, t.projectId, projects).onDelete('cascade'),
    tenantRef(t, t.ownerMemberId, members).onDelete('cascade'),
    uniqueIndex('saved_views_name_unique').on(
      t.organizationId,
      t.projectId,
      t.ownerMemberId,
      t.name,
    ),
    index('saved_views_project_idx').on(t.organizationId, t.projectId),
  ],
);
