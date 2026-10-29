import { CheckCircle, Circle, Plus, X } from '@phosphor-icons/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Outputs, RelationKind } from '@teamflow/contract';
import { isClosed, type StatusCategory } from '@teamflow/domain';
import { Button, popover, Select, SelectItem, toast } from '@teamflow/ui';
import { useDeferredValue, useState } from 'react';
import { ComboBox, Input, ListBox, ListBoxItem, Popover } from 'react-aria-components';
import { orpc } from '../../lib/api.ts';
import { byRank, type Project, type Task, tasksQuery, useCreateTask } from '../tasks.ts';

type Relation = Outputs['relations']['list'][number];

const KIND_LABEL: Record<RelationKind, string> = {
  blocks: 'Blocks',
  blocked_by: 'Blocked by',
  relates: 'Relates to',
  duplicates: 'Duplicates',
};

const kindOf = (r: Relation): RelationKind =>
  r.type === 'blocks' ? (r.direction === 'outgoing' ? 'blocks' : 'blocked_by') : r.type;

function StatusMark({ category }: { category: StatusCategory }) {
  return isClosed(category) ? (
    <CheckCircle weight="fill" className="shrink-0 text-success" aria-label="Done" />
  ) : (
    <Circle className="shrink-0 text-ink-faint" aria-label="Open" />
  );
}

/** Sub-tasks of a task, with progress, and a one-line way to add another. */
export function Subtasks({
  task,
  project,
  canEdit,
  onOpen,
}: {
  task: Task;
  project: Project;
  canEdit: boolean;
  onOpen: (identifier: string) => void;
}) {
  const tasks = useQuery(tasksQuery(project.id));
  const create = useCreateTask(project);
  const [title, setTitle] = useState('');
  const children = (tasks.data ?? []).filter((t) => t.parentTaskId === task.id).sort(byRank);
  const category = (t: Task) =>
    project.statuses.find((s) => s.id === t.statusId)?.category ?? 'unstarted';
  const done = children.filter((t) => isClosed(category(t))).length;

  return (
    <div className="flex flex-col gap-2">
      {children.length > 0 && (
        <div className="flex items-center gap-2 text-ink-muted text-xs">
          <div
            className="h-1 flex-1 overflow-hidden rounded-full bg-lane"
            role="progressbar"
            aria-label="Sub-tasks done"
            aria-valuemin={0}
            aria-valuemax={children.length}
            aria-valuenow={done}
          >
            <div
              className="h-full bg-success"
              style={{ width: `${(done / children.length) * 100}%` }}
            />
          </div>
          {done} of {children.length}
        </div>
      )}
      <ul className="flex flex-col">
        {children.map((child) => (
          <li key={child.id}>
            <button
              type="button"
              onClick={() => onOpen(child.identifier)}
              className="flex w-full items-center gap-2 rounded-control px-1.5 py-1 text-left text-sm outline-none hover:bg-raised focus-visible:outline-2 focus-visible:outline-marigold"
            >
              <StatusMark category={category(child)} />
              <span className="text-ink-faint text-xs">{child.identifier}</span>
              <span
                className={`truncate ${isClosed(category(child)) ? 'text-ink-faint line-through' : ''}`}
              >
                {child.title}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {canEdit && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!title.trim()) return;
            const todo =
              project.statuses.find((s) => s.category === 'unstarted') ?? project.statuses[0];
            create.mutate({
              id: crypto.randomUUID(),
              title: title.trim(),
              statusId: todo?.id ?? task.statusId,
              sprintId: task.sprintId,
              parentTaskId: task.id,
            });
            // Clear straight away (the task appears optimistically), so quick successive adds never lose text.
            setTitle('');
          }}
        >
          <input
            aria-label="New sub-task"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Add a sub-task, then Enter"
            className="h-8 w-full rounded-control border border-transparent bg-transparent px-1.5 text-sm outline-none placeholder:text-ink-faint hover:border-line focus:border-line focus-visible:outline-2 focus-visible:outline-marigold"
          />
        </form>
      )}
    </div>
  );
}

/** Blocks / blocked by / relates to / duplicates, grouped, with a search picker to add more. */
export function Relations({
  task,
  canEdit,
  onOpen,
}: {
  task: Task;
  canEdit: boolean;
  onOpen: (identifier: string) => void;
}) {
  const queryClient = useQueryClient();
  const relations = useQuery(orpc.relations.list.queryOptions({ input: { taskId: task.id } }));
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: orpc.relations.key() });
    void queryClient.invalidateQueries({
      queryKey: orpc.tasks.history.key({ input: { id: task.id } }),
    });
  };
  const failed = (title: string) => (error: Error) =>
    toast({ title, description: error.message, tone: 'danger' });
  const add = useMutation(
    orpc.relations.add.mutationOptions({ onSuccess: refresh, onError: failed('Not linked') }),
  );
  const remove = useMutation(
    orpc.relations.remove.mutationOptions({ onSuccess: refresh, onError: failed('Not unlinked') }),
  );
  const [adding, setAdding] = useState(false);
  const [kind, setKind] = useState<RelationKind>('relates');

  const groups = (Object.keys(KIND_LABEL) as RelationKind[])
    .map((k) => ({ kind: k, items: (relations.data ?? []).filter((r) => kindOf(r) === k) }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="flex flex-col gap-3">
      {groups.map((group) => (
        <div key={group.kind}>
          <p className="mb-1 text-ink-faint text-xs">{KIND_LABEL[group.kind]}</p>
          <ul>
            {group.items.map((r) => (
              <li
                key={r.id}
                className="group flex items-center gap-2 rounded-control px-1.5 py-1 hover:bg-raised"
              >
                <StatusMark category={r.task.statusCategory} />
                <button
                  type="button"
                  onClick={() => onOpen(r.task.identifier)}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm outline-none focus-visible:outline-2 focus-visible:outline-marigold"
                >
                  <span className="text-ink-faint text-xs">{r.task.identifier}</span>
                  <span className="truncate">{r.task.title}</span>
                </button>
                {canEdit && (
                  <Button
                    variant="quiet"
                    size="sm"
                    aria-label={`Remove link to ${r.task.identifier}`}
                    className="size-6 px-0 opacity-0 group-hover:opacity-100 data-[focus-visible]:opacity-100"
                    onPress={() => remove.mutate({ id: r.id })}
                  >
                    <X />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
      {groups.length === 0 && !adding && (
        <p className="text-ink-faint text-xs">Not linked to other tasks.</p>
      )}

      {canEdit &&
        (adding ? (
          <div className="flex items-start gap-2">
            <div className="w-32">
              <Select
                aria-label="Link type"
                selectedKey={kind}
                onSelectionChange={(key) => setKind(key as RelationKind)}
              >
                {(Object.keys(KIND_LABEL) as RelationKind[]).map((k) => (
                  <SelectItem key={k} id={k}>
                    {KIND_LABEL[k]}
                  </SelectItem>
                ))}
              </Select>
            </div>
            <TaskPicker
              excludeId={task.id}
              onPick={(otherTaskId) => {
                add.mutate({ taskId: task.id, kind, otherTaskId });
                setAdding(false);
              }}
              onCancel={() => setAdding(false)}
            />
          </div>
        ) : (
          <Button variant="quiet" size="sm" className="self-start" onPress={() => setAdding(true)}>
            <Plus /> Link a task
          </Button>
        ))}
    </div>
  );
}

/** Find any task in the workspace by words or identifier. */
function TaskPicker({
  excludeId,
  onPick,
  onCancel,
}: {
  excludeId: string;
  onPick: (id: string) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState('');
  const query = useDeferredValue(text.trim());
  const results = useQuery({
    ...orpc.search.tasks.queryOptions({ input: { q: query, limit: 8 } }),
    enabled: query.length > 0,
    placeholderData: (previous) => previous,
  });
  const items = (results.data ?? []).filter((t) => t.id !== excludeId);

  return (
    <ComboBox
      aria-label="Task to link"
      autoFocus
      inputValue={text}
      onInputChange={setText}
      items={items}
      menuTrigger="input"
      allowsEmptyCollection
      onSelectionChange={(key) => key && onPick(String(key))}
      className="flex-1"
    >
      <Input
        placeholder="Search by title or ID"
        onKeyDown={(event) => event.key === 'Escape' && !text && onCancel()}
        className="h-9 w-full rounded-control border border-line bg-surface px-2.5 text-sm outline-none placeholder:text-ink-faint focus-visible:outline-2 focus-visible:outline-marigold"
      />
      <Popover placement="bottom start" className={`${popover} w-(--trigger-width)`}>
        <ListBox
          className="outline-none"
          renderEmptyState={() => <p className="p-2 text-ink-muted text-xs">No matching tasks.</p>}
        >
          {(item: (typeof items)[number]) => (
            <ListBoxItem
              id={item.id}
              textValue={`${item.identifier} ${item.title}`}
              className="flex cursor-default items-center gap-2 rounded-[4px] px-2 py-1.5 text-sm outline-none data-[focused]:bg-lane"
            >
              <span className="text-ink-faint text-xs">{item.identifier}</span>
              <span className="truncate">{item.title}</span>
            </ListBoxItem>
          )}
        </ListBox>
      </Popover>
    </ComboBox>
  );
}
