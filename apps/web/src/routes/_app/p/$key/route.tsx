import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link, notFound, Outlet, useNavigate } from '@tanstack/react-router';
import { type PresenceMember, projectChannel } from '@teamflow/realtime';
import { useMemo } from 'react';
import { z } from 'zod';
import { useLiveProject } from '../../../../features/live.ts';
import { PresenceStack, uniqueMembers } from '../../../../features/presence.tsx';
import { ProjectContext } from '../../../../features/project-context.tsx';
import { TaskPanel } from '../../../../features/task-panel/task-panel.tsx';
import { tasksQuery } from '../../../../features/tasks.ts';
import { orpc } from '../../../../lib/api.ts';
import { usePresence, useRealtimeStatus } from '../../../../lib/realtime.ts';

/** A project, addressed by its key (`/p/TF`). Loads the project with its workflow for every view below. */
export const Route = createFileRoute('/_app/p/$key')({
  validateSearch: z.object({ task: z.string().optional() }),
  loader: async ({ context, params }) => {
    const projects = await context.queryClient.ensureQueryData(
      orpc.projects.list.queryOptions({ input: {} }),
    );
    const summary = projects.find((p) => p.key === params.key);
    if (!summary) throw notFound();
    return context.queryClient.ensureQueryData(
      orpc.projects.get.queryOptions({ input: { id: summary.id } }),
    );
  },
  component: ProjectLayout,
});

function ProjectLayout() {
  const loaded = Route.useLoaderData();
  const { me } = Route.useRouteContext();
  const { task: openIdentifier } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });

  const project =
    useQuery({
      ...orpc.projects.get.queryOptions({ input: { id: loaded.id } }),
      initialData: loaded,
    }).data ?? loaded;
  const tasks = useQuery(tasksQuery(project.id));
  const members = useQuery(orpc.members.list.queryOptions());
  const selfMemberId = members.data?.find((m) => m.userId === me.user.id)?.id ?? null;
  const openTask = openIdentifier
    ? tasks.data?.find((t) => t.identifier.toLowerCase() === openIdentifier.toLowerCase())
    : undefined;

  useLiveProject(project);
  const present = usePresence(projectChannel(project.id), { taskId: openTask?.id ?? null });

  const view = useMemo(() => {
    const viewersByTask = new Map<string, PresenceMember[]>();
    for (const member of uniqueMembers(present)) {
      if (member.memberId === selfMemberId || !member.state.taskId) continue;
      viewersByTask.set(member.state.taskId, [
        ...(viewersByTask.get(member.state.taskId) ?? []),
        member,
      ]);
    }
    return { project, viewersByTask };
  }, [project, present, selfMemberId]);

  return (
    <ProjectContext value={view}>
      <header className="flex h-12 shrink-0 items-center gap-3 border-line border-b px-4">
        <span
          aria-hidden
          className="size-2.5 rounded-full"
          style={{ backgroundColor: project.color }}
        />
        <h1 className="font-semibold text-sm">{project.name}</h1>
        <span className="text-ink-faint text-xs">{project.key}</span>
        <nav aria-label="Views" className="ml-4 flex gap-1">
          {(
            [
              ['/p/$key', 'Board'],
              ['/p/$key/list', 'List'],
              ['/p/$key/backlog', 'Planning'],
            ] as const
          ).map(([to, label]) => (
            <Link
              key={to}
              to={to}
              params={{ key: project.key }}
              activeOptions={{ exact: true }}
              className="rounded-control px-2.5 py-1 text-ink-muted text-sm outline-none hover:bg-lane hover:text-ink focus-visible:outline-2 focus-visible:outline-marigold data-[status=active]:bg-surface data-[status=active]:text-ink data-[status=active]:shadow-[inset_0_0_0_1px_var(--color-line)]"
            >
              {label}
            </Link>
          ))}
        </nav>
        <span className="flex-1" />
        <PresenceStack members={present} selfMemberId={selfMemberId} />
        <ConnectionStatus />
      </header>
      <div className="flex min-h-0 flex-1">
        <main className="min-w-0 flex-1 overflow-auto">
          <Outlet />
        </main>
        {openIdentifier && (
          <TaskPanel
            project={project}
            identifier={openIdentifier}
            onClose={() => navigate({ to: '.', search: (prev) => ({ ...prev, task: undefined }) })}
          />
        )}
      </div>
    </ProjectContext>
  );
}

/** Only speaks up when live updates are not flowing. */
function ConnectionStatus() {
  const status = useRealtimeStatus();
  if (status === 'open') return null;
  return (
    <span role="status" className="text-ink-faint text-xs">
      {status === 'connecting' ? 'Connecting…' : 'Offline — reconnecting'}
    </span>
  );
}
