import { useQuery } from '@tanstack/react-query';
import { comparePriority, isClosed, type Priority } from '@teamflow/domain';
import { Avatar } from '@teamflow/ui';
import { useMemo } from 'react';
import {
  Cell,
  Column,
  type Key,
  Row,
  type SortDescriptor,
  Table,
  TableBody,
  TableHeader,
  TableLayout,
  Virtualizer,
} from 'react-aria-components';
import { orpc } from '../../lib/api.ts';
import { PRIORITY_LABEL, PriorityIcon } from '../board/priority-icon.tsx';
import { sprintsQuery } from '../sprints/queries.ts';
import { type Project, type Task, tasksQuery } from '../tasks.ts';

export type SortColumn =
  | 'identifier'
  | 'title'
  | 'status'
  | 'priority'
  | 'assignee'
  | 'estimate'
  | 'sprint'
  | 'updated';

const updatedFormat = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });

/**
 * Every task in a project as a table: sortable by any column, filterable, virtualized so thousands of rows stay
 * smooth, and fully keyboard navigable (arrow keys between cells, Enter opens the task).
 */
export function TaskTable({
  project,
  query,
  showClosed,
  sort,
  onSortChange,
  onOpenTask,
}: {
  project: Project;
  query: string;
  showClosed: boolean;
  sort: SortDescriptor;
  onSortChange: (sort: SortDescriptor) => void;
  onOpenTask: (task: Task) => void;
}) {
  const tasks = useQuery(tasksQuery(project.id));
  const members = useQuery(orpc.members.list.queryOptions());
  const sprints = useQuery(sprintsQuery(project.id));

  const statusById = useMemo(
    () => new Map(project.statuses.map((s, i) => [s.id, { ...s, order: i }])),
    [project.statuses],
  );
  const memberById = useMemo(
    () => new Map((members.data ?? []).map((m) => [m.id, m])),
    [members.data],
  );
  const sprintById = useMemo(
    () => new Map((sprints.data ?? []).map((s) => [s.id, s])),
    [sprints.data],
  );

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = (tasks.data ?? []).filter((t) => {
      const status = statusById.get(t.statusId);
      if (!showClosed && status && isClosed(status.category)) return false;
      return !needle || `${t.identifier} ${t.title}`.toLowerCase().includes(needle);
    });
    const value = (t: Task): string | number => {
      switch (sort.column as SortColumn) {
        case 'identifier':
          return t.number;
        case 'title':
          return t.title.toLowerCase();
        case 'status':
          return statusById.get(t.statusId)?.order ?? 0;
        case 'priority':
          return comparePriority(t.priority, 'none');
        case 'assignee':
          return t.assigneeMemberId ? (memberById.get(t.assigneeMemberId)?.name ?? '') : '~';
        case 'estimate':
          return t.estimate ?? -1;
        case 'sprint':
          return t.sprintId
            ? (sprintById.get(t.sprintId)?.startsAt.getTime() ?? 0)
            : Number.MAX_SAFE_INTEGER;
        default:
          return t.updatedAt.getTime();
      }
    };
    const direction = sort.direction === 'descending' ? -1 : 1;
    return filtered.sort((a, b) => {
      const x = value(a);
      const y = value(b);
      return (x < y ? -1 : x > y ? 1 : b.number - a.number) * direction;
    });
  }, [tasks.data, query, showClosed, sort, statusById, memberById, sprintById]);

  const open = (key: Key) => {
    const task = rows.find((t) => t.id === key);
    if (task) onOpenTask(task);
  };

  const header =
    'sticky top-0 z-10 h-9 cursor-default border-line border-b bg-canvas px-3 text-left font-medium text-ink-muted text-xs outline-none data-[focus-visible]:outline-2 data-[focus-visible]:outline-marigold data-[focus-visible]:-outline-offset-2';
  const cell =
    'truncate px-3 text-sm outline-none data-[focus-visible]:outline-2 data-[focus-visible]:outline-marigold data-[focus-visible]:-outline-offset-2';
  const sortable = (id: SortColumn, label: string, width?: number) => (
    <Column id={id} allowsSorting isRowHeader={id === 'title'} width={width} className={header}>
      {({ sortDirection }) => (
        <span className="flex items-center gap-1">
          {label}
          <span aria-hidden className="text-ink-faint">
            {sortDirection === 'ascending' ? '↑' : sortDirection === 'descending' ? '↓' : ''}
          </span>
        </span>
      )}
    </Column>
  );

  return (
    <Virtualizer layout={TableLayout} layoutOptions={{ rowHeight: 40, headingHeight: 36 }}>
      <Table
        aria-label={`${project.name} tasks`}
        sortDescriptor={sort}
        onSortChange={onSortChange}
        onRowAction={open}
        className="h-full w-full overflow-auto outline-none"
      >
        <TableHeader>
          {sortable('identifier', 'ID', 90)}
          {sortable('title', 'Title')}
          {sortable('status', 'Status', 150)}
          {sortable('priority', 'Priority', 140)}
          {sortable('assignee', 'Assignee', 170)}
          {sortable('estimate', 'Estimate', 90)}
          {sortable('sprint', 'Sprint', 120)}
          {sortable('updated', 'Updated', 100)}
        </TableHeader>
        <TableBody
          items={rows}
          dependencies={[statusById, memberById, sprintById]}
          renderEmptyState={() => (
            <p className="p-10 text-center text-ink-muted text-sm">
              {query ? `No tasks match “${query}”.` : 'No tasks to show.'}
            </p>
          )}
        >
          {(task) => {
            const status = statusById.get(task.statusId);
            const assignee = task.assigneeMemberId
              ? memberById.get(task.assigneeMemberId)
              : undefined;
            const sprint = task.sprintId ? sprintById.get(task.sprintId) : undefined;
            const done = status ? isClosed(status.category) : false;
            return (
              <Row
                id={task.id}
                className="cursor-default border-line border-b outline-none hover:bg-raised data-[focus-visible]:outline-2 data-[focus-visible]:outline-marigold data-[focus-visible]:-outline-offset-2"
              >
                <Cell className={`${cell} text-ink-faint text-xs`}>{task.identifier}</Cell>
                <Cell className={`${cell} ${done ? 'text-ink-faint line-through' : ''}`}>
                  {task.title}
                </Cell>
                <Cell className={cell}>
                  <span className="flex items-center gap-2">
                    <span
                      aria-hidden
                      className="size-2 rounded-full"
                      style={{ backgroundColor: status?.color }}
                    />
                    {status?.name}
                  </span>
                </Cell>
                <Cell className={cell}>
                  <span className="flex items-center gap-2 text-ink-muted">
                    <span aria-hidden className="flex w-4 justify-center">
                      <PriorityIcon priority={task.priority as Priority} />
                    </span>
                    {task.priority === 'none'
                      ? ''
                      : PRIORITY_LABEL[task.priority].replace(' priority', '')}
                  </span>
                </Cell>
                <Cell className={cell}>
                  {assignee ? (
                    <span className="flex items-center gap-2">
                      <Avatar name={assignee.name} src={assignee.image} size="xs" decorative />
                      {assignee.name}
                    </span>
                  ) : (
                    <span className="text-ink-faint">Unassigned</span>
                  )}
                </Cell>
                <Cell className={`${cell} tabular-nums`}>{task.estimate ?? ''}</Cell>
                <Cell className={`${cell} text-ink-muted`}>{sprint?.name ?? ''}</Cell>
                <Cell className={`${cell} text-ink-muted text-xs`}>
                  {updatedFormat.format(task.updatedAt)}
                </Cell>
              </Row>
            );
          }}
        </TableBody>
      </Table>
    </Virtualizer>
  );
}
