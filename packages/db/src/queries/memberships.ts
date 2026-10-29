import { and, asc, eq } from 'drizzle-orm';
import type { Executor } from '../client.ts';
import { members, organizations, users } from '../schema/auth.ts';
import type { Scope } from '../scope.ts';

/**
 * Membership lookups are the one place that legitimately reads across organizations: they answer
 * "which tenants may this user enter?", keyed by the authenticated user, never by input.
 */

export function listUserOrganizations(db: Executor, userId: string) {
  return db
    .select({
      id: organizations.id,
      name: organizations.name,
      slug: organizations.slug,
      logo: organizations.logo,
      role: members.role,
    })
    .from(members)
    .innerJoin(organizations, eq(organizations.id, members.organizationId))
    .where(eq(members.userId, userId))
    .orderBy(asc(organizations.name));
}

export async function findMembership(db: Executor, organizationId: string, userId: string) {
  const [row] = await db
    .select({ id: members.id, role: members.role, organizationId: members.organizationId })
    .from(members)
    .where(and(eq(members.organizationId, organizationId), eq(members.userId, userId)))
    .limit(1);
  return row ?? null;
}

/** Members of the scope's organization with their user profile, for pickers and avatars. */
export function listMembers(scope: Scope) {
  return scope.db
    .select({
      id: members.id,
      userId: users.id,
      name: users.name,
      email: users.email,
      image: users.image,
      role: members.role,
      joinedAt: members.createdAt,
    })
    .from(members)
    .innerJoin(users, eq(users.id, members.userId))
    .where(eq(members.organizationId, scope.organizationId))
    .orderBy(asc(users.name));
}
