import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { Switch, TextField } from '@teamflow/ui';
import { z } from 'zod';
import { type SortColumn, TaskTable } from '../../../../features/list/task-table.tsx';
import { useProjectView } from '../../../../features/project-context.tsx';
import { sprintsQuery } from '../../../../features/sprints/queries.ts';
import { tasksQuery } from '../../../../features/tasks.ts';

const SORTS = [
  'identifier',
  'title',
  'status',
  'priority',
  'assignee',
  'estimate',
  'sprint',
  'updated',
] as const;

export const Route = createFileRoute('/_app/p/$key/list')({
  // The whole view state lives in the URL, so a filtered, sorted list can be shared as a link.
  validateSearch: z.object({
    q: z.string().optional(),
    closed: z.boolean().optional(),
    sort: z.enum(SORTS).optional(),
    dir: z.enum(['ascending', 'descending']).optional(),
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
  const set = (patch: Partial<typeof search>) =>
    navigate({ search: (prev) => ({ ...prev, ...patch }), replace: true });

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-4 px-4 py-3">
        <TextField
          aria-label="Filter tasks"
          placeholder="Filter by title or ID"
          value={search.q ?? ''}
          onChange={(q) => set({ q: q || undefined })}
          className="w-72"
        />
        <Switch
          isSelected={search.closed ?? false}
          onChange={(closed) => set({ closed: closed || undefined })}
        >
          Show done and canceled
        </Switch>
      </div>
      <div className="min-h-0 flex-1 border-line border-t">
        <TaskTable
          project={project}
          query={search.q ?? ''}
          showClosed={search.closed ?? false}
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
