import { createFileRoute, notFound, Outlet } from '@tanstack/react-router';
import { orpc } from '../../../lib/api.ts';

/** A project, addressed by its key (`/p/TF`). Loads the project with its workflow for every view below. */
export const Route = createFileRoute('/_app/p/$key')({
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
      <main className="min-h-0 flex-1 overflow-auto">
        <Outlet />
      </main>
    </>
  );
}
