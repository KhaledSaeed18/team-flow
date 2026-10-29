import { and, desc, eq, isNull, lt } from 'drizzle-orm';
import { members, users } from '../schema/auth.ts';
import { projects } from '../schema/projects.ts';
import { activity } from '../schema/tasks.ts';
import type { Scope } from '../scope.ts';
import { recordActivity } from './events.ts';

/**
 * The workspace's audit trail: activity that is about the workspace rather than one task — people, projects,
 * workflows, labels, sprints and tokens. Task-level changes live in each task's history. Newest first; `before`
 * pages by id (UUID v7, so id order is time order).
 */
export function listAuditLog(scope: Scope, { before, limit }: { before?: string; limit: number }) {
  return scope.db
    .select({
      id: activity.id,
      kind: activity.kind,
      changes: activity.changes,
      createdAt: activity.createdAt,
      actorName: users.name,
      projectKey: projects.key,
      projectName: projects.name,
    })
    .from(activity)
    .leftJoin(
      members,
      and(
        eq(members.organizationId, activity.organizationId),
        eq(members.id, activity.actorMemberId),
      ),
    )
    .leftJoin(users, eq(users.id, members.userId))
    .leftJoin(
      projects,
      and(
        eq(projects.organizationId, activity.organizationId),
        eq(projects.id, activity.projectId),
      ),
    )
    .where(
      and(
        eq(activity.organizationId, scope.organizationId),
        isNull(activity.taskId),
        before ? lt(activity.id, before) : undefined,
      ),
    )
    .orderBy(desc(activity.id))
    .limit(limit);
}

/** A member with their name and email, by member id or email; for describing someone in the audit trail. */
export async function findMemberSummary(scope: Scope, memberIdOrEmail: string) {
  const isId = /^[0-9a-f-]{36}$/i.test(memberIdOrEmail);
  const [row] = await scope.db
    .select({ id: members.id, role: members.role, name: users.name, email: users.email })
    .from(members)
    .innerJoin(users, eq(users.id, members.userId))
    .where(
      and(
        eq(members.organizationId, scope.organizationId),
        isId ? eq(members.id, memberIdOrEmail) : eq(users.email, memberIdOrEmail.toLowerCase()),
      ),
    )
    .limit(1);
  return row ?? null;
}

/**
 * Record something Better Auth did (membership, invitations, the workspace itself). It owns those writes, so this
 * lands just after them rather than in their transaction.
 */
export function recordAuthEvent(
  scope: Scope,
  kind: string,
  changes: { field: string; from: unknown; to: unknown }[],
) {
  return recordActivity(scope, { kind, changes });
}
