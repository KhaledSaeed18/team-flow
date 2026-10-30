import { createFileRoute, notFound } from '@tanstack/react-router';
import { z } from 'zod';
import { SprintReport } from '../../../../../features/sprints/report.tsx';

export const Route = createFileRoute('/_app/p/$key/sprints/$sprintId')({
  // A malformed id can only be a broken link: say so, instead of asking the API.
  beforeLoad: ({ params }) => {
    if (!z.uuid().safeParse(params.sprintId).success) throw notFound();
  },
  component: ReportView,
});

function ReportView() {
  const { sprintId } = Route.useParams();
  return <SprintReport sprintId={sprintId} />;
}
