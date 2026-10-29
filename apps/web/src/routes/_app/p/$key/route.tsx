import { createFileRoute, notFound, Outlet, useNavigate } from '@tanstack/react-router';
import { z } from 'zod';
import { TaskPanel } from '../../../../features/task-panel/task-panel.tsx';
import { orpc } from '../../../../lib/api.ts';

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
  const project = Route.useLoaderData();
  const { task } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  return (
    <>
      <header className="flex h-12 shrink-0 items-center gap-3 border-line border-b px-4">
        <span
          aria-hidden
          className="size-2.5 rounded-full"
          style={{ backgroundColor: project.color }}
        />
        <h1 className="font-semibold text-sm">{project.name}</h1>
        <span className="text-ink-faint text-xs">{project.key}</span>
      </header>
      <div className="flex min-h-0 flex-1">
        <main className="min-w-0 flex-1 overflow-auto">
          <Outlet />
        </main>
        {task && (
          <TaskPanel
            project={project}
            identifier={task}
            onClose={() => navigate({ to: '.', search: (prev) => ({ ...prev, task: undefined }) })}
          />
        )}
      </div>
    </>
  );
}
