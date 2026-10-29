import { useQuery } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { Select, SelectItem } from '@teamflow/ui';
import { z } from 'zod';
import { Board } from '../../../../features/board/board.tsx';
import { useProjectView } from '../../../../features/project-context.tsx';
import { sprintsQuery } from '../../../../features/sprints/queries.ts';
import { tasksQuery } from '../../../../features/tasks.ts';

const ALL = 'all';

export const Route = createFileRoute('/_app/p/$key/')({
  /** `sprint`: a sprint id, `all`, or absent for "the active sprint if there is one". */
  validateSearch: z.object({ sprint: z.string().optional() }),
  loader: async ({ context, parentMatchPromise }) => {
    const parent = await parentMatchPromise;
    if (!parent.loaderData) return;
    await Promise.all([
      context.queryClient.ensureQueryData(tasksQuery(parent.loaderData.id)),
      context.queryClient.ensureQueryData(sprintsQuery(parent.loaderData.id)),
    ]);
  },
  component: BoardView,
});

function BoardView() {
  const { project, viewersByTask } = useProjectView();
  const { sprint } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const sprints = useQuery(sprintsQuery(project.id));
  const open = (sprints.data ?? []).filter((s) => s.status !== 'completed');
  const active = open.find((s) => s.status === 'active');
  const selected = sprint ?? active?.id ?? ALL;

  return (
    <div className="flex h-full flex-col">
      {open.length > 0 && (
        <div className="flex items-center gap-3 px-4 pt-3">
          <div className="w-56">
            <Select
              aria-label="Show tasks from"
              selectedKey={selected}
              onSelectionChange={(key) =>
                navigate({
                  search: (prev) => ({
                    ...prev,
                    sprint: String(key) === (active?.id ?? ALL) ? undefined : String(key),
                  }),
                })
              }
            >
              {open.map((s) => (
                <SelectItem key={s.id} id={s.id} textValue={s.name}>
                  {s.name}
                  {s.status === 'active' && <span className="text-ink-faint text-xs">active</span>}
                </SelectItem>
              ))}
              <SelectItem id={ALL}>All tasks</SelectItem>
            </Select>
          </div>
        </div>
      )}
      <div className="min-h-0 flex-1">
        <Board
          project={project}
          sprintId={selected === ALL ? null : selected}
          viewersByTask={viewersByTask}
          onOpenTask={(task) =>
            navigate({ search: (prev) => ({ ...prev, task: task.identifier }) })
          }
        />
      </div>
    </div>
  );
}
