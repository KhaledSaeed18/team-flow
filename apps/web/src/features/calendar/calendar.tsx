import { CaretLeft, CaretRight, DotsSixVertical } from '@phosphor-icons/react';
import { useQuery } from '@tanstack/react-query';
import {
  addMonths,
  type IsoDate,
  type IsoMonth,
  isClosed,
  monthGrid,
  monthOf,
} from '@teamflow/domain';
import { Button } from '@teamflow/ui';
import { type ReactNode, useRef } from 'react';
import { Button as AriaButton, useDrag, useDrop } from 'react-aria-components';
import { useProjectAccess } from '../../lib/access.ts';
import { type Project, type Task, tasksQuery, useUpdateTask } from '../tasks.ts';

const TASK_TYPE = 'application/x-teamflow-task';
const monthTitle = new Intl.DateTimeFormat(undefined, {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});
const dayLabel = new Intl.DateTimeFormat(undefined, {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  timeZone: 'UTC',
});
const weekdayShort = new Intl.DateTimeFormat(undefined, { weekday: 'short', timeZone: 'UTC' });
const utc = (iso: IsoDate) => new Date(`${iso}T00:00:00Z`);

/** Today on the viewer's wall clock, as a calendar date. */
export function today(): IsoDate {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/**
 * Tasks by due date, a month at a time. Drag a card (or its handle, with the keyboard) to another day to
 * reschedule it, onto the tray to unschedule it, or from the tray onto a day.
 */
export function Calendar({
  project,
  month,
  onMonthChange,
  onOpenTask,
}: {
  project: Project;
  month: IsoMonth;
  onMonthChange: (month: IsoMonth) => void;
  onOpenTask: (task: Task) => void;
}) {
  const tasks = useQuery(tasksQuery(project.id));
  const update = useUpdateTask(project.id);
  const weeks = monthGrid(month);
  const now = today();
  const closed = (t: Task) => {
    const category = project.statuses.find((s) => s.id === t.statusId)?.category;
    return category ? isClosed(category) : false;
  };

  const byDay = new Map<IsoDate, Task[]>();
  for (const task of tasks.data ?? []) {
    if (!task.dueDate) continue;
    byDay.set(task.dueDate, [...(byDay.get(task.dueDate) ?? []), task]);
  }
  const unscheduled = (tasks.data ?? []).filter((t) => !t.dueDate && !closed(t));
  const reschedule = (id: string, dueDate: IsoDate | null) => {
    const task = tasks.data?.find((t) => t.id === id);
    if (task && task.dueDate !== dueDate) update.mutate({ id, patch: { dueDate } });
  };

  return (
    // On a phone the month scrolls sideways and the unscheduled tray sits below it.
    <div className="flex h-full min-h-0 flex-col overflow-y-auto md:flex-row md:overflow-visible">
      <div className="flex min-w-0 flex-col md:flex-1">
        <div className="flex items-center gap-2 px-4 py-3">
          <h2 className="min-w-40 font-semibold text-base" aria-live="polite">
            {monthTitle.format(utc(`${month}-01`))}
          </h2>
          <Button
            variant="quiet"
            size="icon"
            aria-label="Previous month"
            onPress={() => onMonthChange(addMonths(month, -1))}
          >
            <CaretLeft />
          </Button>
          <Button
            variant="quiet"
            size="icon"
            aria-label="Next month"
            onPress={() => onMonthChange(addMonths(month, 1))}
          >
            <CaretRight />
          </Button>
          <Button variant="secondary" size="sm" onPress={() => onMonthChange(monthOf(now))}>
            Today
          </Button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col overflow-x-auto">
          <div className="grid min-w-[40rem] grid-cols-7 border-line border-t text-ink-faint text-xs">
            {weeks[0]?.map((day) => (
              <div key={day} className="px-2 py-1.5">
                {weekdayShort.format(utc(day))}
              </div>
            ))}
          </div>
          <div
            className="grid min-h-0 min-w-[40rem] flex-1 grid-cols-7 border-line border-t"
            style={{ gridTemplateRows: `repeat(${weeks.length}, minmax(6.5rem, 1fr))` }}
          >
            {weeks.flat().map((day) => (
              <DayCell
                key={day}
                day={day}
                outside={monthOf(day) !== month}
                isToday={day === now}
                onDrop={(id) => reschedule(id, day)}
              >
                {(byDay.get(day) ?? []).map((task) => (
                  <TaskChip
                    key={task.id}
                    task={task}
                    project={project}
                    done={closed(task)}
                    onOpen={() => onOpenTask(task)}
                  />
                ))}
              </DayCell>
            ))}
          </div>
        </div>
      </div>
      <Tray onDrop={(id) => reschedule(id, null)}>
        {unscheduled.map((task) => (
          <TaskChip
            key={task.id}
            task={task}
            project={project}
            done={false}
            onOpen={() => onOpenTask(task)}
          />
        ))}
      </Tray>
    </div>
  );
}

function useTaskDrop(onDrop: (id: string) => void) {
  const ref = useRef<HTMLDivElement>(null);
  const { dropProps, isDropTarget } = useDrop({
    ref,
    getDropOperation: (types) => (types.has(TASK_TYPE) ? 'move' : 'cancel'),
    onDrop: async (event) => {
      for (const item of event.items) {
        if (item.kind === 'text' && item.types.has(TASK_TYPE))
          onDrop(await item.getText(TASK_TYPE));
      }
    },
  });
  return { ref, dropProps, isDropTarget };
}

function DayCell({
  day,
  outside,
  isToday,
  onDrop,
  children,
}: {
  day: IsoDate;
  outside: boolean;
  isToday: boolean;
  onDrop: (id: string) => void;
  children: ReactNode;
}) {
  const { ref, dropProps, isDropTarget } = useTaskDrop(onDrop);
  return (
    <section
      ref={ref}
      {...dropProps}
      aria-label={dayLabel.format(utc(day))}
      className={`flex min-h-0 flex-col gap-1 overflow-y-auto border-line border-r border-b p-1.5 outline-none [&:nth-child(7n)]:border-r-0 ${
        outside ? 'bg-canvas' : 'bg-surface'
      } ${isDropTarget ? 'bg-raised ring-2 ring-marigold ring-inset' : ''}`}
    >
      <span
        className={`self-start rounded-full px-1.5 text-xs ${
          isToday
            ? 'bg-ink font-semibold text-canvas'
            : outside
              ? 'text-ink-faint'
              : 'text-ink-muted'
        }`}
      >
        {utc(day).getUTCDate()}
      </span>
      {children}
    </section>
  );
}

function Tray({ onDrop, children }: { onDrop: (id: string) => void; children: ReactNode }) {
  const { ref, dropProps, isDropTarget } = useTaskDrop(onDrop);
  return (
    <section
      ref={ref}
      {...dropProps}
      aria-label="Unscheduled"
      className={`flex shrink-0 flex-col gap-1 border-line border-t p-3 md:w-60 md:overflow-y-auto md:border-t-0 md:border-l ${
        isDropTarget ? 'bg-raised ring-2 ring-marigold ring-inset' : 'bg-canvas'
      }`}
    >
      <h2 className="mb-1 font-medium text-ink-muted text-xs">Unscheduled</h2>
      <p className="mb-2 text-ink-faint text-xs">
        Open tasks without a due date. Drag one onto a day; drop a card here to clear its date.
      </p>
      {children}
    </section>
  );
}

function TaskChip({
  task,
  project,
  done,
  onOpen,
}: {
  task: Task;
  project: Project;
  done: boolean;
  onOpen: () => void;
}) {
  const color = project.statuses.find((s) => s.id === task.statusId)?.color ?? '#94a3b8';
  // Guests and archived projects: the calendar is read-only.
  const canReschedule = useProjectAccess(project).editTasks;
  const { dragProps, dragButtonProps, isDragging } = useDrag({
    isDisabled: !canReschedule,
    hasDragButton: true,
    getItems: () => [{ [TASK_TYPE]: task.id, 'text/plain': `${task.identifier} ${task.title}` }],
  });
  return (
    <div
      {...dragProps}
      className={`group flex items-center gap-1 rounded-[5px] border border-line bg-surface py-0.5 pr-1.5 pl-0.5 text-xs shadow-xs ${
        isDragging ? 'opacity-40' : ''
      }`}
    >
      <AriaButton
        {...dragButtonProps}
        isDisabled={!canReschedule}
        aria-label={`Reschedule ${task.identifier}`}
        className="shrink-0 cursor-grab rounded-[3px] text-ink-faint outline-none data-[focus-visible]:outline-2 data-[focus-visible]:outline-marigold"
      >
        <DotsSixVertical />
      </AriaButton>
      <span
        aria-hidden
        className="size-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: color }}
      />
      <button
        type="button"
        onClick={onOpen}
        className={`min-w-0 flex-1 truncate text-left outline-none focus-visible:outline-2 focus-visible:outline-marigold ${
          done ? 'text-ink-faint line-through' : ''
        }`}
      >
        <span className="text-ink-faint">{task.identifier}</span> {task.title}
      </button>
    </div>
  );
}
