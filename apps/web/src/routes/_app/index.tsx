import { createFileRoute, redirect } from '@tanstack/react-router';
import { orpc } from '../../lib/api.ts';

/** The workspace home opens the first project; with none, the empty state invites creating one. */
export const Route = createFileRoute('/_app/')({
  beforeLoad: async ({ context }) => {
    const projects = await context.queryClient.ensureQueryData(
      orpc.projects.list.queryOptions({ input: {} }),
    );
    const first = projects[0];
    if (first) throw redirect({ to: '/p/$key', params: { key: first.key } });
  },
  component: Empty,
});

function Empty() {
  return (
    <main className="grid flex-1 place-items-center p-8">
      <div className="max-w-sm text-center">
        <h1 className="font-semibold text-lg">Start with a project</h1>
        <p className="mt-2 text-ink-muted text-sm leading-relaxed">
          A project holds a board of tasks and the workflow they move through. Use the + next to
          Projects to create one.
        </p>
      </div>
    </main>
  );
}
