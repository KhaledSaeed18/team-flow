import { DIGEST_FREQUENCIES } from '@teamflow/domain';
import { pgEnum, pgTable, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { members } from './auth.ts';
import { at, tenantColumns, tenantKey, tenantRef } from './tenant.ts';

export const digestFrequency = pgEnum('digest_frequency', DIGEST_FREQUENCIES);

/** Email digest preference per member. No row means the default: daily. */
export const digestSettings = pgTable(
  'digest_settings',
  {
    ...tenantColumns(),
    memberId: uuid().notNull(),
    frequency: digestFrequency().notNull().default('daily'),
    lastSentAt: at(),
  },
  (t) => [
    tenantKey(t),
    tenantRef(t, t.memberId, members).onDelete('cascade'),
    uniqueIndex('digest_settings_member_unique').on(t.organizationId, t.memberId),
  ],
);
