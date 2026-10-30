import { useQuery } from '@tanstack/react-query';
import { can } from '@teamflow/auth/permissions';
import { meQuery } from './session.ts';

type Role = Parameters<typeof can>[0];

/** The signed-in member's role in the active workspace. Unknown while loading, which reads as least access. */
export function useRole(): Role {
  const me = useQuery(meQuery());
  return (
    me.data?.organizations.find((o) => o.id === me.data?.activeOrganizationId)?.role ?? 'guest'
  );
}

/**
 * What the signed-in member may do in a project: their role's permissions, minus everything that changes an
 * archived project (which the API refuses). The UI hides or disables what this says no to, so nobody is offered
 * an action that can only fail.
 */
export function useProjectAccess(project: { archivedAt: Date | string | null } | undefined) {
  const role = useRole();
  const open = !project?.archivedAt;
  return {
    role,
    archived: !open,
    createTasks: open && can(role, { task: ['create'] }),
    editTasks: open && can(role, { task: ['update'] }),
    planSprints: open && can(role, { sprint: ['update'] }),
    createSprints: open && can(role, { sprint: ['create'] }),
    comment: open && can(role, { comment: ['create'] }),
  };
}
