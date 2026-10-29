import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useProjectView } from '../../../../features/project-context.tsx';
import { Backlog } from '../../../../features/sprints/backlog.tsx';
import { sprintsQuery } from '../../../../features/sprints/queries.ts';
import { tasksQuery } from '../../../../features/tasks.ts';

export const Route = createFileRoute('/_app/p/$key/backlog')({
  loader: async ({ context, parentMatchPromise }) => {
    const parent = await parentMatchPromise;
    if (!parent.loaderData) return;
    await Promise.all([
      context.queryClient.ensureQueryData(tasksQuery(parent.loaderData.id)),
      context.queryClient.ensureQueryData(sprintsQuery(parent.loaderData.id)),
    ]);
  },
  component: BacklogView,
});

function BacklogView() {
  const { project } = useProjectView();
  const navigate = useNavigate();
  return (
    <Backlog
      project={project}
      onOpenTask={(task) =>
        navigate({ to: '.', search: (prev) => ({ ...prev, task: task.identifier }) })
      }
    />
  );
}
