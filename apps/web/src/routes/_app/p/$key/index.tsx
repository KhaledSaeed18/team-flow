import { createFileRoute, getRouteApi } from '@tanstack/react-router';
import { Board } from '../../../../features/board/board.tsx';
import { tasksQuery } from '../../../../features/tasks.ts';

const project = getRouteApi('/_app/p/$key');

export const Route = createFileRoute('/_app/p/$key/')({
  loader: async ({ context, parentMatchPromise }) => {
    const parent = await parentMatchPromise;
    if (parent.loaderData)
      await context.queryClient.ensureQueryData(tasksQuery(parent.loaderData.id));
  },
  component: BoardView,
});

function BoardView() {
  const data = project.useLoaderData();
  return <Board project={data} onOpenTask={() => {}} />;
}
