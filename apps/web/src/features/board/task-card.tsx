import { DotsSixVertical } from '@phosphor-icons/react';
import type { Outputs } from '@teamflow/contract';
import type { PresenceMember } from '@teamflow/realtime';
import { Avatar } from '@teamflow/ui';
import { Button, GridListItem } from 'react-aria-components';
import type { Task } from '../tasks.ts';
import { PriorityIcon } from './priority-icon.tsx';

type Member = Outputs['members']['list'][number];
type Label = Outputs['labels']['list'][number];

export interface CardLookups {
  members: Map<string, Member>;
  labels: Map<string, Label>;
  /** Sub-task progress by parent task id. */
  progress: Map<string, { done: number; total: number }>;
}

export function TaskCard({
  task,
  lookups,
  viewers,
}: {
  task: Task;
  lookups: CardLookups;
  viewers: PresenceMember[];
}) {
  const assignee = task.assigneeMemberId ? lookups.members.get(task.assigneeMemberId) : undefined;
  const labels = task.labelIds.flatMap((id) => lookups.labels.get(id) ?? []);
  const pending = task.number === 0;

  return (
    <GridListItem
      id={task.id}
      textValue={`${task.identifier} ${task.title}`}
      className={({ isDragging, isFocusVisible, isDropTarget }) =>
        [
          'group relative cursor-default rounded-card border bg-surface p-3 text-left outline-none transition-shadow',
          isFocusVisible
            ? 'border-marigold outline-2 outline-marigold outline-offset-2'
            : 'border-line',
          isDragging ? 'opacity-40' : 'hover:border-line-strong',
          isDropTarget ? 'border-marigold' : '',
          pending ? 'opacity-70' : '',
        ].join(' ')
      }
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-2xs text-ink-faint">{task.identifier}</p>
          <p className="mt-0.5 text-sm leading-snug">{task.title}</p>
        </div>
        {viewers.length > 0 && (
          <span
            className="flex -space-x-1"
            title={`Open by ${viewers.map((v) => v.name).join(', ')}`}
          >
            {viewers.slice(0, 3).map((viewer) => (
              <Avatar
                key={viewer.memberId}
                name={viewer.name}
                src={viewer.image}
                size="xs"
                decorative
                className="ring-2 ring-surface"
              />
            ))}
            <span className="sr-only">Open by {viewers.map((v) => v.name).join(', ')}</span>
          </span>
        )}
        <Button
          slot="drag"
          aria-label={`Move ${task.identifier}`}
          className="-mr-1.5 rounded-[4px] p-0.5 text-ink-faint opacity-0 outline-none group-hover:opacity-100 data-[focus-visible]:opacity-100 data-[focus-visible]:outline-2 data-[focus-visible]:outline-marigold"
        >
          <DotsSixVertical />
        </Button>
      </div>

      {(labels.length > 0 ||
        assignee ||
        task.priority !== 'none' ||
        task.estimate !== null ||
        lookups.progress.has(task.id)) && (
        <div className="mt-2.5 flex items-center gap-2">
          <PriorityIcon priority={task.priority} />
          {labels.map((label) => (
            <span key={label.id} className="inline-flex items-center gap-1 text-2xs text-ink-muted">
              <span
                aria-hidden
                className="size-1.5 rounded-full"
                style={{ backgroundColor: label.color }}
              />
              {label.name}
            </span>
          ))}
          <span className="flex-1" />
          {lookups.progress.get(task.id) && (
            <span className="text-2xs text-ink-faint" title="Sub-tasks done">
              {lookups.progress.get(task.id)?.done}/{lookups.progress.get(task.id)?.total}
            </span>
          )}
          {task.estimate !== null && (
            <span className="text-2xs text-ink-faint" title="Estimate">
              {task.estimate}
            </span>
          )}
          {assignee && <Avatar name={assignee.name} src={assignee.image} size="xs" />}
        </div>
      )}
    </GridListItem>
  );
}
