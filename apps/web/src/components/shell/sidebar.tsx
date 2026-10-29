import { ClockCounterClockwise, Plus, Tray, UsersThree } from '@phosphor-icons/react';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { can } from '@teamflow/auth/permissions';
import { Button, Tooltip } from '@teamflow/ui';
import { useInbox } from '../../features/inbox/inbox.ts';
import { orpc } from '../../lib/api.ts';
import type { Me } from '../../lib/session.ts';
import { WorkspaceMenu } from './workspace-menu.tsx';

export function Sidebar({ me, onCreateProject }: { me: Me; onCreateProject: () => void }) {
  const projects = useQuery(orpc.projects.list.queryOptions({ input: {} }));
  const unread = useInbox().data?.unread ?? 0;
  const role = me.organizations.find((o) => o.id === me.activeOrganizationId)?.role ?? 'guest';

  return (
    <nav
      aria-label="Workspace"
      className="flex h-full w-60 shrink-0 flex-col gap-4 border-line border-r bg-canvas p-2"
    >
      <WorkspaceMenu me={me} />

      <Link
        to="/inbox"
        className="focus-ring flex items-center gap-2 rounded-control px-2 py-1.5 text-ink-muted text-sm outline-none hover:bg-lane hover:text-ink focus-visible:outline-2 focus-visible:outline-marigold data-[status=active]:bg-surface data-[status=active]:text-ink"
      >
        <Tray aria-hidden /> <span className="flex-1">Inbox</span>
        {unread > 0 && (
          <span className="rounded-full bg-ink px-1.5 font-medium text-2xs text-canvas tabular-nums">
            {unread > 99 ? '99+' : unread}
            <span className="sr-only"> unread</span>
          </span>
        )}
      </Link>
      <Link
        to="/settings/members"
        className="focus-ring flex items-center gap-2 rounded-control px-2 py-1.5 text-ink-muted text-sm outline-none hover:bg-lane hover:text-ink focus-visible:outline-2 focus-visible:outline-marigold data-[status=active]:bg-surface data-[status=active]:text-ink"
      >
        <UsersThree aria-hidden /> Members
      </Link>
      {can(role, { audit: ['read'] }) && (
        <Link
          to="/settings/audit"
          className="focus-ring flex items-center gap-2 rounded-control px-2 py-1.5 text-ink-muted text-sm outline-none hover:bg-lane hover:text-ink focus-visible:outline-2 focus-visible:outline-marigold data-[status=active]:bg-surface data-[status=active]:text-ink"
        >
          <ClockCounterClockwise aria-hidden /> Audit log
        </Link>
      )}

      <div className="flex flex-col gap-0.5">
        <div className="flex items-center justify-between px-2 pb-1">
          <h2 className="font-medium text-ink-muted text-xs">Projects</h2>
          <Tooltip content="New project">
            <Button
              variant="quiet"
              size="sm"
              aria-label="New project"
              className="size-6 px-0"
              onPress={onCreateProject}
            >
              <Plus />
            </Button>
          </Tooltip>
        </div>
        {projects.data?.map((project) => (
          <Link
            key={project.id}
            to="/p/$key"
            params={{ key: project.key }}
            className="focus-ring flex items-center gap-2 rounded-control px-2 py-1.5 text-ink-muted text-sm outline-none hover:bg-lane hover:text-ink data-[status=active]:bg-surface data-[status=active]:text-ink data-[status=active]:shadow-[inset_0_0_0_1px_var(--color-line)] focus-visible:outline-2 focus-visible:outline-marigold"
          >
            <span
              aria-hidden
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: project.color }}
            />
            <span className="flex-1 truncate">{project.name}</span>
            <span className="text-2xs text-ink-faint">{project.key}</span>
          </Link>
        ))}
        {projects.data?.length === 0 && (
          <p className="px-2 py-1 text-ink-faint text-xs">No projects yet.</p>
        )}
      </div>
    </nav>
  );
}
