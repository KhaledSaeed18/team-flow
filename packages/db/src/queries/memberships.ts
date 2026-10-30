import { and, asc, eq, sql } from 'drizzle-orm';
import type { Executor } from '../client.ts';
import { invitations, members, organizations, users } from '../schema/auth.ts';
import { projects } from '../schema/projects.ts';
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

/** An invitation's workspace, email and status, for auditing what a cancel actually changed. */
export async function findInvitation(db: Executor, id: string) {
  const [row] = await db
    .select({
      organizationId: invitations.organizationId,
      email: invitations.email,
      status: invitations.status,
    })
    .from(invitations)
    .where(eq(invitations.id, id))
    .limit(1);
  return row ?? null;
}

/** Invitations still pending for `email` in a workspace: a new invitation to the same address cancels them. */
export function pendingInvitations(db: Executor, organizationId: string, email: string) {
  return db
    .select({ id: invitations.id })
    .from(invitations)
    .where(
      and(
        eq(invitations.organizationId, organizationId),
        eq(sql`lower(${invitations.email})`, email.toLowerCase()),
        eq(invitations.status, 'pending'),
      ),
    );
}

/**
 * The user's workspaces that have a project with this key: a link like `/p/QP` carries no workspace, so the app
 * asks which of yours it belongs to before saying it does not exist. Only the user's own memberships are searched.
 */
export function workspacesWithProject(db: Executor, userId: string, key: string) {
  return db
    .select({ id: organizations.id, name: organizations.name })
    .from(members)
    .innerJoin(organizations, eq(organizations.id, members.organizationId))
    .innerJoin(
      projects,
      and(eq(projects.organizationId, members.organizationId), eq(projects.key, key)),
    )
    .where(eq(members.userId, userId))
    .orderBy(asc(organizations.name));
}
