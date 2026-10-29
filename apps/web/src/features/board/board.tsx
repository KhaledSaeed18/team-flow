import { Plus } from '@phosphor-icons/react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@teamflow/ui';
import { useMemo, useState } from 'react';
import { DropIndicator, GridList, Input, TextField, useDragAndDrop } from 'react-aria-components';
import { orpc } from '../../lib/api.ts';
import {
  byRank,
  type Placement,
  type Project,
  type Task,
  tasksQuery,
  useCreateTask,
  useMoveTask,
} from '../tasks.ts';
import { type CardLookups, TaskCard } from './task-card.tsx';

const TASK_TYPE = 'application/x-teamflow-task';

type Status = Project['statuses'][number];

export function Board({
  project,
  onOpenTask,
}: {
  project: Project;
  onOpenTask: (task: Task) => void;
}) {
  const tasks = useQuery(tasksQuery(project.id));
  const members = useQuery(orpc.members.list.queryOptions());
  const labels = useQuery(orpc.labels.list.queryOptions({ input: { projectId: project.id } }));
  const move = useMoveTask(project.id);

  const lookups: CardLookups = useMemo(
    () => ({
      members: new Map((members.data ?? []).map((m) => [m.id, m])),
      labels: new Map((labels.data ?? []).map((l) => [l.id, l])),
    }),
    [members.data, labels.data],
  );

  const columns = useMemo(() => {
    const byStatus = new Map<string, Task[]>(project.statuses.map((s) => [s.id, []]));
    for (const task of tasks.data ?? []) byStatus.get(task.statusId)?.push(task);
    for (const list of byStatus.values()) list.sort(byRank);
    return byStatus;
  }, [tasks.data, project.statuses]);

  return (
    <div className="flex h-full gap-3 overflow-x-auto p-4" aria-busy={tasks.isPending}>
      {project.statuses.map((status) => (
        <Column
          key={status.id}
          status={status}
          project={project}
          tasks={columns.get(status.id) ?? []}
          lookups={lookups}
          onMove={(id, place) => move.mutate({ id, place })}
          onOpenTask={onOpenTask}
        />
      ))}
    </div>
  );
}

interface ColumnProps {
  status: Status;
  project: Project;
  tasks: Task[];
  lookups: CardLookups;
  onMove: (id: string, place: Placement) => void;
  onOpenTask: (task: Task) => void;
}

function Column({ status, project, tasks, lookups, onMove, onOpenTask }: ColumnProps) {
  const byId = (id: unknown) => tasks.find((t) => t.id === id);

  const place = (id: string, target: { key: unknown; dropPosition: 'before' | 'after' | 'on' }) => {
    const targetId = String(target.key);
    if (targetId === id) return;
    onMove(
      id,
      target.dropPosition === 'before'
        ? { statusId: status.id, beforeId: targetId }
        : { statusId: status.id, afterId: targetId },
    );
  };

  const { dragAndDropHooks } = useDragAndDrop<Task>({
    getItems: (keys) =>
      [...keys].flatMap((key) => {
        const task = byId(key);
        return task
          ? [{ [TASK_TYPE]: task.id, 'text/plain': `${task.identifier} ${task.title}` }]
          : [];
      }),
    acceptedDragTypes: [TASK_TYPE],
    getDropOperation: () => 'move',
    renderDropIndicator: (target) => (
      <DropIndicator
        target={target}
        className="-my-[3px] h-0.5 rounded-full outline-none data-[drop-target]:bg-marigold"
      />
    ),
    onReorder: (event) => {
      const [first] = event.keys;
      if (first !== undefined) place(String(first), event.target);
    },
    onInsert: async (event) => {
      const item = event.items.find((i) => i.kind === 'text' && i.types.has(TASK_TYPE));
      if (item?.kind === 'text') place(await item.getText(TASK_TYPE), event.target);
    },
    onRootDrop: async (event) => {
      const item = event.items.find((i) => i.kind === 'text' && i.types.has(TASK_TYPE));
      if (item?.kind === 'text') onMove(await item.getText(TASK_TYPE), { statusId: status.id });
    },
  });

  return (
    <section aria-label={status.name} className="flex w-72 shrink-0 flex-col rounded-lane bg-lane">
      <header className="flex items-center gap-2 px-3 pt-3 pb-2">
        <span
          aria-hidden
          className="size-2 rounded-full"
          style={{ backgroundColor: status.color }}
        />
        <h2 className="font-medium text-sm">{status.name}</h2>
        <span className="text-ink-faint text-xs">{tasks.length}</span>
      </header>
      <GridList
        aria-label={`${status.name} tasks`}
        items={tasks}
        dragAndDropHooks={dragAndDropHooks}
        onAction={(key) => {
          const task = byId(key);
          if (task) onOpenTask(task);
        }}
        renderEmptyState={({ isDropTarget }) => (
          <div
            className={`grid h-20 place-items-center rounded-card border border-dashed text-ink-faint text-xs ${
              isDropTarget ? 'border-marigold bg-marigold-soft/40' : 'border-line'
            }`}
          >
            Nothing here
          </div>
        )}
        className={({ isDropTarget }) =>
          `flex min-h-24 flex-1 flex-col gap-2 overflow-y-auto rounded-card px-2 pb-2 outline-none ${
            isDropTarget ? 'bg-marigold-soft/30' : ''
          }`
        }
      >
        {(task) => <TaskCard task={task} lookups={lookups} />}
      </GridList>
      <QuickAdd project={project} statusId={status.id} />
    </section>
  );
}

function QuickAdd({ project, statusId }: { project: Project; statusId: string }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const create = useCreateTask(project);

  if (!open) {
    return (
      <Button
        variant="quiet"
        size="sm"
        className="mx-2 mb-2 justify-start"
        onPress={() => setOpen(true)}
      >
        <Plus /> Add task
      </Button>
    );
  }

  return (
    <form
      className="mx-2 mb-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (!title.trim()) return;
        create.mutate({ id: crypto.randomUUID(), title: title.trim(), statusId });
        setTitle('');
      }}
    >
      <TextField aria-label="New task title" value={title} onChange={setTitle} autoFocus>
        <Input
          placeholder="Task title, then Enter"
          onKeyDown={(event) => {
            if (event.key === 'Escape') setOpen(false);
          }}
          onBlur={() => !title && setOpen(false)}
          className="focus-ring h-9 w-full rounded-card border border-line bg-surface px-3 text-sm placeholder:text-ink-faint"
        />
      </TextField>
    </form>
  );
}
