import { createAccessControl } from 'better-auth/plugins/access';
import { defaultStatements } from 'better-auth/plugins/organization/access';

/**
 * Every action a member can be allowed to take, by resource. Shared by the server (enforcement) and the web app
 * (deciding what to render), so both read the same table.
 *
 * Roles are cumulative: guest ⊂ member ⊂ admin ⊂ owner.
 */
export const statements = {
  ...defaultStatements,
  project: ['create', 'update', 'archive', 'delete'],
  workflow: ['update'],
  task: ['create', 'update', 'delete'],
  sprint: ['create', 'update', 'delete'],
  label: ['create', 'update', 'delete'],
  comment: ['create', 'moderate'],
  integration: ['manage'],
  audit: ['read'],
} as const;

export type Statements = typeof statements;
export type Resource = keyof Statements;
export type Action<R extends Resource> = Statements[R][number];
export type PermissionRequest = { [R in Resource]?: Action<R>[] };

export const ac = createAccessControl(statements);

const guestGrants = {
  comment: ['create'],
} as const;

const memberGrants = {
  ...guestGrants,
  ac: ['read'],
  project: ['create', 'update'],
  task: ['create', 'update', 'delete'],
  sprint: ['create', 'update'],
  label: ['create', 'update'],
} as const;

const adminGrants = {
  ...memberGrants,
  organization: ['update'],
  member: ['create', 'update', 'delete'],
  invitation: ['create', 'cancel'],
  team: ['create', 'update', 'delete'],
  ac: ['create', 'read', 'update', 'delete'],
  project: ['create', 'update', 'archive', 'delete'],
  workflow: ['update'],
  sprint: ['create', 'update', 'delete'],
  label: ['create', 'update', 'delete'],
  comment: ['create', 'moderate'],
  integration: ['manage'],
  audit: ['read'],
} as const;

const ownerGrants = {
  ...adminGrants,
  organization: ['update', 'delete'],
} as const;

export const roles = {
  guest: ac.newRole(guestGrants),
  member: ac.newRole(memberGrants),
  admin: ac.newRole(adminGrants),
  owner: ac.newRole(ownerGrants),
};

export const ROLES = ['owner', 'admin', 'member', 'guest'] as const;
export type Role = (typeof ROLES)[number];

export const isRole = (value: unknown): value is Role =>
  typeof value === 'string' && (ROLES as readonly string[]).includes(value);

/**
 * Pure permission check for a role. Better Auth stores a member's roles as a comma-separated string; a member is
 * allowed if any of their roles is.
 */
export function can(role: string, request: PermissionRequest): boolean {
  return role
    .split(',')
    .map((r) => r.trim())
    .filter(isRole)
    .some((r) => roles[r].authorize(request).success);
}

const RANK: Record<Role, number> = { guest: 0, member: 1, admin: 2, owner: 3 };

/** Whether `actor` may assign `target` — nobody can grant a role above their own. */
export const canAssignRole = (actor: Role, target: Role): boolean => RANK[actor] >= RANK[target];
