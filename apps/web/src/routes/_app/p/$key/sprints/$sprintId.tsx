import { createFileRoute } from '@tanstack/react-router';
import { SprintReport } from '../../../../../features/sprints/report.tsx';

export const Route = createFileRoute('/_app/p/$key/sprints/$sprintId')({ component: ReportView });

function ReportView() {
  const { sprintId } = Route.useParams();
  return <SprintReport sprintId={sprintId} />;
}
