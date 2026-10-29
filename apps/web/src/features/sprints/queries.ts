import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Outputs } from '@teamflow/contract';
import { toast } from '@teamflow/ui';
import { orpc } from '../../lib/api.ts';
import { tasksQuery } from '../tasks.ts';

export type Sprint = Outputs['sprints']['list'][number];

export const sprintsQuery = (projectId: string) =>
  orpc.sprints.list.queryOptions({ input: { projectId } });

const failed = (title: string) => (error: unknown) =>
  toast({ title, description: (error as Error).message, tone: 'danger' });

/** Sprint mutations; each refreshes the project's sprints and tasks when it lands. */
export function useSprintActions(projectId: string) {
  const queryClient = useQueryClient();
  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: sprintsQuery(projectId).queryKey }),
      queryClient.invalidateQueries({ queryKey: tasksQuery(projectId).queryKey }),
      queryClient.invalidateQueries({ queryKey: orpc.sprints.report.key() }),
    ]);

  return {
    create: useMutation(
      orpc.sprints.create.mutationOptions({
        onSuccess: refresh,
        onError: failed('Sprint not created'),
      }),
    ),
    start: useMutation(
      orpc.sprints.start.mutationOptions({
        onSuccess: refresh,
        onError: failed('Sprint not started'),
      }),
    ),
    complete: useMutation(
      orpc.sprints.complete.mutationOptions({
        onSuccess: refresh,
        onError: failed('Sprint not completed'),
      }),
    ),
  };
}

const dateFormat = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });

export const sprintDates = (sprint: Pick<Sprint, 'startsAt' | 'endsAt'>) =>
  `${dateFormat.format(sprint.startsAt)} – ${dateFormat.format(sprint.endsAt)}`;

/** "Ends in 3 days", "Ended 2 days ago", "Starts tomorrow". */
export function sprintTiming(sprint: Sprint, now = new Date()): string {
  const days = (date: Date) => Math.round((date.getTime() - now.getTime()) / 86_400_000);
  const relative = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
  if (sprint.status === 'completed')
    return `Completed ${relative.format(days(sprint.completedAt ?? sprint.endsAt), 'day')}`;
  if (sprint.status === 'active') return `Ends ${relative.format(days(sprint.endsAt), 'day')}`;
  return `Starts ${relative.format(days(sprint.startsAt), 'day')}`;
}
