import { DIGEST_LOOKBACK_MS, type DigestFrequency } from '@teamflow/domain';
import { and, desc, eq, gt, isNull, sql } from 'drizzle-orm';
import type { Executor } from '../client.ts';
import { members, organizations, users } from '../schema/auth.ts';
import { notifications } from '../schema/collaboration.ts';
import { digestSettings } from '../schema/digests.ts';
import type { Scope } from '../scope.ts';

const DEFAULT: DigestFrequency = 'daily';

export async function getDigestFrequency(scope: Scope, memberId: string): Promise<DigestFrequency> {
  const [row] = await scope.db
    .select({ frequency: digestSettings.frequency })
    .from(digestSettings)
    .where(
      and(
        eq(digestSettings.organizationId, scope.organizationId),
        eq(digestSettings.memberId, memberId),
      ),
    )
    .limit(1);
  return row?.frequency ?? DEFAULT;
}

export async function setDigestFrequency(
  scope: Scope,
  memberId: string,
  frequency: DigestFrequency,
) {
  await scope.db
    .insert(digestSettings)
    .values({ organizationId: scope.organizationId, memberId, frequency })
    .onConflictDoUpdate({
      target: [digestSettings.organizationId, digestSettings.memberId],
      set: { frequency },
    });
}

/**
 * Everyone, in every organization, who wants digests and has something unread since their last one (and within
 * the lookback). The worker's job, so it reads across tenants; whether each is due is decided by the caller.
 */
export function digestCandidates(db: Executor, now: Date) {
  const frequency = sql<DigestFrequency>`coalesce(${digestSettings.frequency}, ${DEFAULT}::digest_frequency)`;
  const floor = new Date(now.getTime() - DIGEST_LOOKBACK_MS);
  return db
    .select({
      organizationId: members.organizationId,
      organizationName: organizations.name,
      memberId: members.id,
      email: users.email,
      name: users.name,
      frequency,
      lastSentAt: digestSettings.lastSentAt,
    })
    .from(members)
    .innerJoin(users, eq(users.id, members.userId))
    .innerJoin(organizations, eq(organizations.id, members.organizationId))
    .leftJoin(
      digestSettings,
      and(
        eq(digestSettings.organizationId, members.organizationId),
        eq(digestSettings.memberId, members.id),
      ),
    )
    .where(
      and(
        sql`${frequency} <> 'off'`,
        sql`exists (
          select 1 from ${notifications}
          where ${notifications.organizationId} = ${members.organizationId}
            and ${notifications.recipientMemberId} = ${members.id}
            and ${notifications.readAt} is null
            and ${notifications.createdAt} > greatest(coalesce(${digestSettings.lastSentAt}, '-infinity'::timestamptz), ${floor.toISOString()}::timestamptz)
        )`,
      ),
    );
}

/** Unread notifications for one member since `since`, newest first, with who caused them. */
export function digestItems(
  db: Executor,
  organizationId: string,
  memberId: string,
  since: Date,
  limit = 25,
) {
  return db
    .select({
      kind: notifications.kind,
      data: notifications.data,
      createdAt: notifications.createdAt,
      actorName: users.name,
    })
    .from(notifications)
    .leftJoin(
      members,
      and(
        eq(members.organizationId, notifications.organizationId),
        eq(members.id, notifications.actorMemberId),
      ),
    )
    .leftJoin(users, eq(users.id, members.userId))
    .where(
      and(
        eq(notifications.organizationId, organizationId),
        eq(notifications.recipientMemberId, memberId),
        isNull(notifications.readAt),
        gt(notifications.createdAt, since),
      ),
    )
    .orderBy(desc(notifications.createdAt), desc(notifications.id))
    .limit(limit);
}

export async function markDigestSent(
  db: Executor,
  organizationId: string,
  memberId: string,
  now: Date,
) {
  await db
    .insert(digestSettings)
    .values({ organizationId, memberId, lastSentAt: now })
    .onConflictDoUpdate({
      target: [digestSettings.organizationId, digestSettings.memberId],
      set: { lastSentAt: now },
    });
}
