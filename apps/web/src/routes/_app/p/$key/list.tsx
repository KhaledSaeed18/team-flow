import { useQuery } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { can } from '@teamflow/auth/permissions';
import { ListSort, SortDirection } from '@teamflow/contract';
import { TaskFilter } from '@teamflow/domain';
import { Switch, TextField } from '@teamflow/ui';
import { z } from 'zod';
import { FilterBar } from '../../../../features/list/filter-bar.tsx';
import { filterOf, type ListState, SavedViews } from '../../../../features/list/saved-views.tsx';
import { type SortColumn, TaskTable } from '../../../../features/list/task-table.tsx';
import { useProjectView } from '../../../../features/project-context.tsx';
import { sprintsQuery } from '../../../../features/sprints/queries.ts';
import { tasksQuery } from '../../../../features/tasks.ts';
import { orpc } from '../../../../lib/api.ts';
import { meQuery } from '../../../../lib/session.ts';

export const Route = createFileRoute('/_app/p/$key/list')({
  // The whole view state lives in the URL, so a filtered, sorted list can be shared as a link.
  validateSearch: TaskFilter.extend({
    sort: ListSort.optional(),
    dir: SortDirection.optional(),
    view: z.string().optional(),
  }),
  loader: async ({ context, parentMatchPromise }) => {
    const parent = await parentMatchPromise;
    if (!parent.loaderData) return;
    await Promise.all([
      context.queryClient.ensureQueryData(tasksQuery(parent.loaderData.id)),
      context.queryClient.ensureQueryData(sprintsQuery(parent.loaderData.id)),
    ]);
  },
  component: ListView,
});

function ListView() {
  const { project } = useProjectView();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const me = useQuery(meQuery());
  const members = useQuery(orpc.members.list.queryOptions());
  const memberId = members.data?.find((m) => m.userId === me.data?.user.id)?.id ?? null;
  const role =
    me.data?.organizations.find((o) => o.id === me.data?.activeOrganizationId)?.role ?? 'guest';

  const set = (patch: Partial<ListState>) =>
    navigate({ search: (prev) => ({ ...prev, ...patch }), replace: true });
  // Applying a view replaces the whole state, but keeps an open task open.
  const apply = (state: ListState) =>
    navigate({ search: (prev) => ({ ...state, task: (prev as { task?: string }).task }) });

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-3 px-4 py-3">
        <TextField
          aria-label="Filter tasks"
          placeholder="Filter by title or ID"
          value={search.q ?? ''}
          onChange={(q) => set({ q: q || undefined })}
          className="w-64"
        />
        <FilterBar project={project} filter={filterOf(search)} onChange={set} />
        <Switch
          isSelected={search.closed ?? false}
          onChange={(closed) => set({ closed: closed || undefined })}
        >
          Show done and canceled
        </Switch>
        <div className="ml-auto">
          <SavedViews
            projectId={project.id}
            state={search}
            canShare={can(role, { project: ['update'] })}
            onApply={apply}
          />
        </div>
      </div>
      <div className="min-h-0 flex-1 border-line border-t">
        <TaskTable
          project={project}
          filter={filterOf(search)}
          memberId={memberId}
          sort={{ column: search.sort ?? 'status', direction: search.dir ?? 'ascending' }}
          onSortChange={(sort) => set({ sort: sort.column as SortColumn, dir: sort.direction })}
          onOpenTask={(task) =>
            navigate({ search: (prev) => ({ ...prev, task: task.identifier }) })
          }
        />
      </div>
    </div>
  );
}
