import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { isIsoMonth, monthOf } from '@teamflow/domain';
import { z } from 'zod';
import { Calendar, today } from '../../../../features/calendar/calendar.tsx';
import { useProjectView } from '../../../../features/project-context.tsx';
import { tasksQuery } from '../../../../features/tasks.ts';

export const Route = createFileRoute('/_app/p/$key/calendar')({
  validateSearch: z.object({ month: z.string().refine(isIsoMonth).optional() }),
  loader: async ({ context, parentMatchPromise }) => {
    const parent = await parentMatchPromise;
    if (parent.loaderData)
      await context.queryClient.ensureQueryData(tasksQuery(parent.loaderData.id));
  },
  component: CalendarView,
});

function CalendarView() {
  const { project } = useProjectView();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  return (
    <Calendar
      project={project}
      month={search.month ?? monthOf(today())}
      onMonthChange={(month) => navigate({ search: (prev) => ({ ...prev, month }) })}
      onOpenTask={(task) => navigate({ search: (prev) => ({ ...prev, task: task.identifier }) })}
    />
  );
}
