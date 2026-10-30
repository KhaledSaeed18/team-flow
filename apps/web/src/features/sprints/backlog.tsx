import { ChartLine, DotsSixVertical, Plus } from '@phosphor-icons/react';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { isClosed } from '@teamflow/domain';
import { Avatar, Button, Dialog, Select, SelectItem, TextField } from '@teamflow/ui';
import { useMemo, useState } from 'react';
import {
  Button as AriaButton,
  Form,
  GridList,
  GridListItem,
  useDragAndDrop,
} from 'react-aria-components';
import { orpc } from '../../lib/api.ts';
import { PriorityIcon } from '../board/priority-icon.tsx';
import { type Project, type Task, tasksQuery, useUpdateTask } from '../tasks.ts';
import {
  type Sprint,
  sprintDates,
  sprintsQuery,
  sprintTiming,
  useSprintActions,
} from './queries.ts';

const TASK_TYPE = 'application/x-teamflow-task';
const BACKLOG = 'backlog';

/**
 * Planning: the active sprint, the planned ones, and the backlog, one above the other. Drag a task (or use the
 * keyboard, as on the board) from one to another to change its sprint.
 */
export function Backlog({
  project,
  onOpenTask,
}: {
  project: Project;
  onOpenTask: (task: Task) => void;
}) {
  const tasks = useQuery(tasksQuery(project.id));
  const sprints = useQuery(sprintsQuery(project.id));
  const members = useQuery(orpc.members.list.queryOptions());
  const update = useUpdateTask(project.id);
  const actions = useSprintActions(project.id);
  const [creating, setCreating] = useState(false);
  const [completing, setCompleting] = useState<Sprint | null>(null);

  const closedStatus = useMemo(
    () => new Set(project.statuses.filter((s) => isClosed(s.category)).map((s) => s.id)),
    [project.statuses],
  );
  const open = (sprints.data ?? []).filter((s) => s.status !== 'completed');
  const sections = useMemo(() => {
    const bySprint = new Map<string, Task[]>();
    for (const task of tasks.data ?? []) {
      const key = task.sprintId ?? BACKLOG;
      // Finished work stays visible in its sprint but leaves the backlog.
      if (key === BACKLOG && closedStatus.has(task.statusId)) continue;
      bySprint.set(key, [...(bySprint.get(key) ?? []), task]);
    }
    return bySprint;
  }, [tasks.data, closedStatus]);

  const moveTo = (taskId: string, sprintId: string | null) => {
    const task = tasks.data?.find((t) => t.id === taskId);
    if (task && task.sprintId !== sprintId) update.mutate({ id: taskId, patch: { sprintId } });
  };

  const memberById = new Map((members.data ?? []).map((m) => [m.id, m]));
  const points = (list: Task[]) => list.reduce((sum, t) => sum + (t.estimate ?? 0), 0);

  return (
    <div className="flex w-full flex-col gap-6 p-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-base">Planning</h2>
        <Button variant="secondary" onPress={() => setCreating(true)}>
          <Plus /> New sprint
        </Button>
      </div>

      {open.map((sprint) => {
        const list = sections.get(sprint.id) ?? [];
        return (
          <Section
            key={sprint.id}
            id={sprint.id}
            title={sprint.name}
            subtitle={`${sprintDates(sprint)}. ${sprintTiming(sprint)}.`}
            summary={`${list.length} tasks, ${points(list)} points`}
            tasks={list}
            closedStatus={closedStatus}
            memberById={memberById}
            onDrop={(taskId) => moveTo(taskId, sprint.id)}
            onOpenTask={onOpenTask}
            actions={
              <>
                <Link
                  to="/p/$key/sprints/$sprintId"
                  params={{ key: project.key, sprintId: sprint.id }}
                  className="focus-ring inline-flex h-7 items-center gap-1.5 rounded-control px-2 text-ink-muted text-xs outline-none hover:bg-lane hover:text-ink focus-visible:outline-2 focus-visible:outline-marigold"
                >
                  <ChartLine aria-hidden /> Report
                </Link>
                {sprint.status === 'planned' ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    isPending={actions.start.isPending}
                    onPress={() => actions.start.mutate({ id: sprint.id, version: sprint.version })}
                  >
                    Start sprint
                  </Button>
                ) : (
                  <Button size="sm" variant="primary" onPress={() => setCompleting(sprint)}>
                    Complete sprint
                  </Button>
                )}
              </>
            }
          />
        );
      })}

      <Section
        id={BACKLOG}
        title="Backlog"
        subtitle="Work not planned into a sprint."
        summary={`${(sections.get(BACKLOG) ?? []).length} tasks`}
        tasks={sections.get(BACKLOG) ?? []}
        closedStatus={closedStatus}
        memberById={memberById}
        onDrop={(taskId) => moveTo(taskId, null)}
        onOpenTask={onOpenTask}
      />

      <NewSprintDialog
        isOpen={creating}
        onOpenChange={setCreating}
        project={project}
        suggestedName={`Sprint ${(sprints.data?.length ?? 0) + 1}`}
        suggestedStart={(sprints.data ?? []).at(-1)?.endsAt ?? new Date()}
      />
      {completing && (
        <CompleteSprintDialog
          sprint={completing}
          planned={open.filter((s) => s.status === 'planned')}
          onClose={() => setCompleting(null)}
          onComplete={(carryOverTo) =>
            actions.complete.mutate(
              { id: completing.id, version: completing.version, carryOverTo },
              { onSuccess: () => setCompleting(null) },
            )
          }
          pending={actions.complete.isPending}
        />
      )}
    </div>
  );
}

type MemberLike = { name: string; image: string | null };

interface SectionProps {
  id: string;
  title: string;
  subtitle: string;
  summary: string;
  tasks: Task[];
  closedStatus: Set<string>;
  memberById: Map<string, MemberLike>;
  onDrop: (taskId: string) => void;
  onOpenTask: (task: Task) => void;
  actions?: React.ReactNode;
}

function Section({
  id,
  title,
  subtitle,
  summary,
  tasks,
  closedStatus,
  memberById,
  onDrop,
  onOpenTask,
  actions,
}: SectionProps) {
  const { dragAndDropHooks } = useDragAndDrop<Task>({
    getItems: (keys) =>
      [...keys].flatMap((key) => {
        const task = tasks.find((t) => t.id === key);
        return task
          ? [{ [TASK_TYPE]: task.id, 'text/plain': `${task.identifier} ${task.title}` }]
          : [];
      }),
    acceptedDragTypes: [TASK_TYPE],
    getDropOperation: () => 'move',
    onRootDrop: async (event) => {
      const item = event.items.find((i) => i.kind === 'text' && i.types.has(TASK_TYPE));
      if (item?.kind === 'text') onDrop(await item.getText(TASK_TYPE));
    },
    onInsert: async (event) => {
      const item = event.items.find((i) => i.kind === 'text' && i.types.has(TASK_TYPE));
      if (item?.kind === 'text') onDrop(await item.getText(TASK_TYPE));
    },
  });

  return (
    <section aria-labelledby={`section-${id}`} className="rounded-lane bg-lane p-3">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1 px-1 pb-2">
        <h3 id={`section-${id}`} className="font-semibold text-sm">
          {title}
        </h3>
        <span className="text-ink-faint text-xs">{summary}</span>
        <span className="flex-1" />
        {actions}
        <p className="w-full text-ink-muted text-xs">{subtitle}</p>
      </header>
      <GridList
        aria-labelledby={`section-${id}`}
        items={tasks}
        dragAndDropHooks={dragAndDropHooks}
        dependencies={[closedStatus, memberById]}
        onAction={(key) => {
          const task = tasks.find((t) => t.id === key);
          if (task) onOpenTask(task);
        }}
        renderEmptyState={({ isDropTarget }) => (
          <p
            className={`rounded-card border border-dashed px-3 py-4 text-center text-ink-faint text-xs ${
              isDropTarget ? 'border-ink-muted bg-surface' : 'border-line'
            }`}
          >
            Drag tasks here
          </p>
        )}
        className={({ isDropTarget }) =>
          `flex flex-col overflow-hidden rounded-card border border-line bg-surface outline-none ${
            isDropTarget ? 'ring-2 ring-ink-muted' : ''
          } empty:border-0 empty:bg-transparent`
        }
      >
        {(task) => {
          const assignee = task.assigneeMemberId
            ? memberById.get(task.assigneeMemberId)
            : undefined;
          const done = closedStatus.has(task.statusId);
          return (
            <GridListItem
              id={task.id}
              textValue={`${task.identifier} ${task.title}`}
              className={({ isFocusVisible, isDragging }) =>
                `flex h-10 cursor-default items-center gap-3 border-line border-b px-3 text-sm outline-none last:border-b-0 hover:bg-raised ${
                  isFocusVisible ? 'relative z-10 outline-2 outline-marigold -outline-offset-2' : ''
                } ${isDragging ? 'opacity-40' : ''}`
              }
            >
              {/* The handle is what keyboard and screen reader users pick the row up with. */}
              <AriaButton
                slot="drag"
                aria-label={`Move ${task.identifier}`}
                className="-mx-1 rounded-[4px] p-0.5 text-ink-faint outline-none data-[focus-visible]:outline-2 data-[focus-visible]:outline-marigold"
              >
                <DotsSixVertical />
              </AriaButton>
              <span className="w-4">
                <PriorityIcon priority={task.priority} />
              </span>
              <span className="w-14 shrink-0 text-ink-faint text-xs">{task.identifier}</span>
              <span className={`flex-1 truncate ${done ? 'text-ink-faint line-through' : ''}`}>
                {task.title}
              </span>
              {task.estimate !== null && (
                <span className="text-ink-faint text-xs">{task.estimate}</span>
              )}
              {assignee && <Avatar name={assignee.name} src={assignee.image} size="xs" />}
            </GridListItem>
          );
        }}
      </GridList>
    </section>
  );
}

const toDateInput = (date: Date) => date.toISOString().slice(0, 10);

function NewSprintDialog({
  isOpen,
  onOpenChange,
  project,
  suggestedName,
  suggestedStart,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  project: Project;
  suggestedName: string;
  suggestedStart: Date;
}) {
  const actions = useSprintActions(project.id);
  const [weeks, setWeeks] = useState('2');

  return (
    <Dialog isOpen={isOpen} onOpenChange={onOpenChange} title="New sprint">
      {({ close }) => (
        <Form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            const startsAt = new Date(`${String(data.get('startsAt'))}T09:00:00`);
            const endsAt = new Date(startsAt.getTime() + Number(weeks) * 7 * 86_400_000);
            actions.create.mutate(
              {
                projectId: project.id,
                name: String(data.get('name')),
                goal: String(data.get('goal') ?? ''),
                startsAt,
                endsAt,
              },
              { onSuccess: close },
            );
          }}
        >
          <TextField name="name" label="Name" defaultValue={suggestedName} isRequired autoFocus />
          <TextField name="goal" label="Goal" placeholder="What should this sprint achieve?" />
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5 font-medium text-sm">
              Starts
              <input
                type="date"
                name="startsAt"
                required
                defaultValue={toDateInput(suggestedStart)}
                className="h-9 rounded-control border border-line bg-surface px-2.5 font-normal outline-none focus-visible:outline-2 focus-visible:outline-marigold"
              />
            </label>
            <Select
              label="Length"
              selectedKey={weeks}
              onSelectionChange={(key) => setWeeks(String(key))}
            >
              {['1', '2', '3', '4'].map((n) => (
                <SelectItem key={n} id={n}>
                  {n === '1' ? '1 week' : `${n} weeks`}
                </SelectItem>
              ))}
            </Select>
          </div>
          <div className="mt-2 flex justify-end gap-2">
            <Button variant="quiet" onPress={close}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isPending={actions.create.isPending}>
              Create sprint
            </Button>
          </div>
        </Form>
      )}
    </Dialog>
  );
}

function CompleteSprintDialog({
  sprint,
  planned,
  onClose,
  onComplete,
  pending,
}: {
  sprint: Sprint;
  planned: Sprint[];
  onClose: () => void;
  onComplete: (carryOverTo: string | null) => void;
  pending: boolean;
}) {
  const [target, setTarget] = useState<string>(planned[0]?.id ?? BACKLOG);
  return (
    <Dialog
      isOpen
      onOpenChange={(open) => !open && onClose()}
      title={`Complete ${sprint.name}`}
      description="Unfinished tasks move on. Finished ones stay with this sprint for its report."
      width="sm"
    >
      <div className="flex flex-col gap-4">
        <Select
          label="Move unfinished tasks to"
          selectedKey={target}
          onSelectionChange={(key) => setTarget(String(key))}
        >
          {[
            ...planned.map((s) => ({ id: s.id, name: s.name })),
            { id: BACKLOG, name: 'Backlog' },
          ].map((option) => (
            <SelectItem key={option.id} id={option.id}>
              {option.name}
            </SelectItem>
          ))}
        </Select>
        <div className="flex justify-end gap-2">
          <Button variant="quiet" onPress={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            isPending={pending}
            onPress={() => onComplete(target === BACKLOG ? null : target)}
          >
            Complete sprint
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
