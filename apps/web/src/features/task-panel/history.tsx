import { useQuery } from '@tanstack/react-query';
import type { Outputs } from '@teamflow/contract';
import { Avatar } from '@teamflow/ui';
import { orpc } from '../../lib/api.ts';
import { PRIORITY_LABEL } from '../board/priority-icon.tsx';
import type { Project } from '../tasks.ts';

type Entry = Outputs['tasks']['history'][number];
type Member = Outputs['members']['list'][number];

const relative = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
function ago(date: Date) {
  const seconds = (date.getTime() - Date.now()) / 1000;
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['day', 86_400],
    ['hour', 3_600],
    ['minute', 60],
  ];
  for (const [unit, size] of units)
    if (Math.abs(seconds) >= size) return relative.format(Math.round(seconds / size), unit);
  return 'just now';
}

/** One readable sentence per change, from the field-level activity log. */
function narrate(entry: Entry, project: Project, members: Map<string, Member>): string[] {
  const statusName = (value: unknown) =>
    project.statuses.find((s) => s.id === (value as { id?: string } | null)?.id)?.name ??
    'a removed status';
  if (entry.kind === 'task.created')
    return [`created the task in ${statusName(entry.changes[0]?.to)}`];
  if (entry.kind === 'task.deleted') return ['deleted the task'];
  return entry.changes.map(({ field, from, to }) => {
    switch (field) {
      case 'status':
        return `moved it from ${statusName(from)} to ${statusName(to)}`;
      case 'title':
        return `renamed it to “${String(to)}”`;
      case 'description':
        return 'edited the description';
      case 'priority':
        return `set ${PRIORITY_LABEL[to as keyof typeof PRIORITY_LABEL].toLowerCase()}`;
      case 'estimate':
        return to === null ? 'removed the estimate' : `estimated it at ${String(to)}`;
      case 'assigneeMemberId':
        return to === null
          ? 'unassigned it'
          : `assigned it to ${members.get(String(to))?.name ?? 'a former member'}`;
      case 'dueDate':
        return to === null ? 'removed the due date' : `set the due date to ${String(to)}`;
      case 'labelIds':
        return 'changed the labels';
      case 'parentTaskId':
        return to === null ? 'made it a top-level task' : 'made it a sub-task';
      case 'sprintId':
        return to === null ? 'moved it to the backlog' : 'moved it into a sprint';
      case 'relation': {
        const r = (to ?? from) as { type: string; direction: string } | null;
        const verb =
          r?.type === 'blocks'
            ? r.direction === 'outgoing'
              ? 'blocking'
              : 'blocked by'
            : r?.type === 'duplicates'
              ? 'duplicate'
              : 'related';
        return to === null ? `removed a ${verb} link` : `added a ${verb} link`;
      }
      case 'attachment':
        return to === null ? `removed ${String(from)}` : `attached ${String(to)}`;
      default:
        return `changed ${field}`;
    }
  });
}

export function History({ taskId, project }: { taskId: string; project: Project }) {
  const history = useQuery(orpc.tasks.history.queryOptions({ input: { id: taskId } }));
  const members = useQuery(orpc.members.list.queryOptions());
  const byId = new Map((members.data ?? []).map((m) => [m.id, m]));

  return (
    <ol className="flex flex-col gap-3">
      {history.data?.flatMap((entry) =>
        narrate(entry, project, byId).map((sentence) => {
          const actor = entry.actorMemberId ? byId.get(entry.actorMemberId) : undefined;
          return (
            <li key={`${entry.id}:${sentence}`} className="flex items-start gap-2 text-xs">
              <Avatar name={actor?.name ?? 'TeamFlow'} src={actor?.image} size="xs" decorative />
              <p className="text-ink-muted leading-5">
                <span className="font-medium text-ink">{actor?.name ?? 'Someone'}</span> {sentence}{' '}
                <time dateTime={entry.createdAt.toISOString()} className="text-ink-faint">
                  {ago(entry.createdAt)}
                </time>
              </p>
            </li>
          );
        }),
      )}
    </ol>
  );
}
