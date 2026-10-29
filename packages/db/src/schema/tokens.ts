import { sql } from 'drizzle-orm';
import { check, index, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { members } from './auth.ts';
import { at, createdAt, tenantColumns, tenantKey, tenantRef } from './tenant.ts';

/**
 * Personal access tokens for the public REST API. Each acts as its member in one organization. Only a SHA-256
 * of the secret is stored; `prefix` is the first characters, shown so people can tell their tokens apart.
 */
export const apiTokens = pgTable(
  'api_tokens',
  {
    ...tenantColumns(),
    memberId: uuid().notNull(),
    name: text().notNull(),
    prefix: text().notNull(),
    tokenHash: text().notNull().unique(),
    access: text().$type<'read' | 'write'>().notNull(),
    expiresAt: at(),
    lastUsedAt: at(),
    createdAt: createdAt(),
  },
  (t) => [
    tenantKey(t),
    tenantRef(t, t.memberId, members).onDelete('cascade'),
    check('api_tokens_access_check', sql`${t.access} in ('read', 'write')`),
    index('api_tokens_member_idx').on(t.organizationId, t.memberId),
  ],
);
