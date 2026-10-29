import { DotsSixVertical } from '@phosphor-icons/react';
import type { Outputs } from '@teamflow/contract';
import { Avatar } from '@teamflow/ui';
import { Button, GridListItem } from 'react-aria-components';
import type { Task } from '../tasks.ts';
import { PriorityIcon } from './priority-icon.tsx';

type Member = Outputs['members']['list'][number];
type Label = Outputs['labels']['list'][number];

export interface CardLookups {
  members: Map<string, Member>;
  labels: Map<string, Label>;
}

export function TaskCard({ task, lookups }: { task: Task; lookups: CardLookups }) {
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
        <Button
          slot="drag"
          aria-label={`Move ${task.identifier}`}
          className="-mr-1.5 rounded-[4px] p-0.5 text-ink-faint opacity-0 outline-none group-hover:opacity-100 data-[focus-visible]:opacity-100 data-[focus-visible]:outline-2 data-[focus-visible]:outline-marigold"
        >
          <DotsSixVertical />
        </Button>
      </div>

      {(labels.length > 0 || assignee || task.priority !== 'none' || task.estimate !== null) && (
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
