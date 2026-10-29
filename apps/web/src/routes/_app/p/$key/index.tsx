import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { Board } from '../../../../features/board/board.tsx';
import { useProjectView } from '../../../../features/project-context.tsx';
import { tasksQuery } from '../../../../features/tasks.ts';

export const Route = createFileRoute('/_app/p/$key/')({
  loader: async ({ context, parentMatchPromise }) => {
    const parent = await parentMatchPromise;
    if (parent.loaderData)
      await context.queryClient.ensureQueryData(tasksQuery(parent.loaderData.id));
  },
  component: BoardView,
});

function BoardView() {
  const { project, viewersByTask } = useProjectView();
  const navigate = useNavigate();
  return (
    <Board
      project={project}
      viewersByTask={viewersByTask}
      onOpenTask={(task) =>
        navigate({ to: '.', search: (prev) => ({ ...prev, task: task.identifier }) })
      }
    />
  );
}
