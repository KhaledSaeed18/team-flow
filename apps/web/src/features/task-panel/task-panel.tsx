import { Tag as TagIcon, X } from '@phosphor-icons/react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { can } from '@teamflow/auth/permissions';
import { PRIORITIES, type Priority } from '@teamflow/domain';
import { Avatar, Button, popover, Select, SelectItem } from '@teamflow/ui';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import {
  Button as AriaButton,
  Dialog,
  DialogTrigger,
  Input,
  Label,
  ListBox,
  ListBoxItem,
  NumberField,
  Popover,
  TextArea,
  TextField,
} from 'react-aria-components';
import { orpc } from '../../lib/api.ts';
import { meQuery } from '../../lib/session.ts';
import { isTyping } from '../../lib/shortcuts.ts';
import { PRIORITY_LABEL, PriorityIcon } from '../board/priority-icon.tsx';
import { type Project, type Task, tasksQuery, useUpdateTask } from '../tasks.ts';
import { Attachments } from './attachments.tsx';
import { Comments } from './comments.tsx';
import { DescriptionEditor } from './description-editor.tsx';
import { History } from './history.tsx';
import { Relations, Subtasks } from './related-work.tsx';

const NONE = '__none__';

/**
 * The task sheet. It sits beside the board rather than over it, so you can keep an eye on the board — and
 * later, on other people moving cards — while you edit.
 */
export function TaskPanel({
  project,
  identifier,
  onClose,
}: {
  project: Project;
  identifier: string;
  onClose: () => void;
}) {
  const tasks = useQuery(tasksQuery(project.id));
  const task = tasks.data?.find((t) => t.identifier.toLowerCase() === identifier.toLowerCase());

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      // Escape in a field belongs to the field (undo a title edit, keep a half-written comment), not the panel.
      if (
        event.key === 'Escape' &&
        !event.defaultPrevented &&
        !isTyping(event.target) &&
        !document.querySelector('[data-rac][role="dialog"]')
      ) {
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <aside
      aria-label={task ? `${task.identifier} ${task.title}` : 'Task'}
      className="flex w-[440px] shrink-0 animate-slide-in flex-col border-line border-l bg-surface"
    >
      <header className="flex h-12 shrink-0 items-center justify-between border-line border-b px-4">
        <span className="text-ink-muted text-xs">{task?.identifier ?? identifier}</span>
        <Button variant="quiet" size="icon" aria-label="Close task" onPress={onClose}>
          <X />
        </Button>
      </header>
      {task ? (
        <TaskDetails key={task.id} task={task} project={project} />
      ) : (
        <p className="p-6 text-ink-muted text-sm">
          {tasks.isPending
            ? 'Loading…'
            : 'This task does not exist in this project, or it was deleted.'}
        </p>
      )}
    </aside>
  );
}

function TaskDetails({ task, project }: { task: Task; project: Project }) {
  const update = useUpdateTask(project.id);
  const members = useQuery(orpc.members.list.queryOptions());
  const labels = useQuery(orpc.labels.list.queryOptions({ input: { projectId: project.id } }));
  const me = useQuery(meQuery());
  const role =
    me.data?.organizations.find((o) => o.id === me.data?.activeOrganizationId)?.role ?? 'guest';
  const canEdit = can(role, { task: ['update'] });
  const navigate = useNavigate();
  const openTask = (identifier: string) => {
    const key = identifier.split('-')[0] ?? project.key;
    void navigate({ to: '/p/$key', params: { key }, search: { task: identifier } });
  };
  const save = (patch: Parameters<typeof update.mutate>[0]['patch']) =>
    update.mutate({ id: task.id, patch });

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="flex flex-col gap-4 p-5">
        <CommitField
          label="Title"
          value={task.title}
          required
          onCommit={(title) => save({ title: title.trim() })}
          className="font-semibold text-lg leading-snug"
        />
        <DescriptionEditor
          key={task.id}
          taskId={task.id}
          userName={me.data?.user.name ?? 'Someone'}
          readOnly={!canEdit}
        />
      </div>

      <dl className="grid grid-cols-[7rem_minmax(0,1fr)] items-center gap-x-3 gap-y-2 border-line border-t px-5 py-4 text-sm">
        <Property label="Status">
          <Select
            aria-label="Status"
            selectedKey={task.statusId}
            onSelectionChange={(key) => save({ statusId: String(key) })}
            items={project.statuses}
          >
            {(status) => (
              <SelectItem id={status.id} textValue={status.name}>
                <span
                  aria-hidden
                  className="size-2 rounded-full"
                  style={{ backgroundColor: status.color }}
                />
                {status.name}
              </SelectItem>
            )}
          </Select>
        </Property>
        <Property label="Priority">
          <Select
            aria-label="Priority"
            selectedKey={task.priority}
            onSelectionChange={(key) => save({ priority: key as Priority })}
          >
            {PRIORITIES.map((priority) => (
              <SelectItem key={priority} id={priority} textValue={PRIORITY_LABEL[priority]}>
                <span aria-hidden className="flex w-4 justify-center">
                  <PriorityIcon priority={priority} />
                </span>
                {PRIORITY_LABEL[priority]}
              </SelectItem>
            ))}
          </Select>
        </Property>
        <Property label="Assignee">
          <Select
            aria-label="Assignee"
            selectedKey={task.assigneeMemberId ?? NONE}
            onSelectionChange={(key) =>
              save({ assigneeMemberId: key === NONE ? null : String(key) })
            }
          >
            <SelectItem id={NONE} textValue="Unassigned">
              <span className="text-ink-muted">Unassigned</span>
            </SelectItem>
            {(members.data ?? []).map((member) => (
              <SelectItem key={member.id} id={member.id} textValue={member.name}>
                <Avatar name={member.name} src={member.image} size="xs" decorative />
                {member.name}
              </SelectItem>
            ))}
          </Select>
        </Property>
        <Property label="Labels">
          <LabelPicker
            options={labels.data ?? []}
            selected={task.labelIds}
            onChange={(labelIds) => save({ labelIds })}
          />
        </Property>
        <Property label="Estimate">
          <NumberField
            aria-label="Estimate"
            minValue={0}
            maxValue={100}
            value={task.estimate ?? Number.NaN}
            onChange={(value) => save({ estimate: Number.isNaN(value) ? null : value })}
          >
            <Input
              placeholder="Points"
              className="focus-ring h-9 w-24 rounded-control border border-line bg-surface px-2.5 text-sm placeholder:text-ink-faint"
            />
          </NumberField>
        </Property>
        <Property label="Due date">
          <input
            type="date"
            aria-label="Due date"
            value={task.dueDate ?? ''}
            onChange={(event) => save({ dueDate: event.target.value || null })}
            className="h-9 rounded-control border border-line bg-surface px-2.5 text-sm outline-none focus-visible:outline-2 focus-visible:outline-marigold"
          />
        </Property>
      </dl>

      <section aria-label="Sub-tasks" className="border-line border-t px-5 py-4">
        <h2 className="mb-2 font-medium text-ink-muted text-xs">Sub-tasks</h2>
        <Subtasks task={task} project={project} canEdit={canEdit} onOpen={openTask} />
      </section>

      <section aria-label="Linked tasks" className="border-line border-t px-5 py-4">
        <h2 className="mb-2 font-medium text-ink-muted text-xs">Linked tasks</h2>
        <Relations task={task} canEdit={canEdit} onOpen={openTask} />
      </section>

      <section aria-label="Attachments" className="border-line border-t px-5 py-4">
        <h2 className="mb-2 font-medium text-ink-muted text-xs">Attachments</h2>
        <Attachments taskId={task.id} canEdit={canEdit} />
      </section>

      <section aria-label="Comments" className="border-line border-t px-5 py-4">
        <h2 className="mb-3 font-medium text-ink-muted text-xs">Comments</h2>
        <Comments taskId={task.id} />
      </section>

      <section aria-label="History" className="border-line border-t px-5 py-4">
        <h2 className="mb-3 font-medium text-ink-muted text-xs">History</h2>
        <History taskId={task.id} project={project} />
      </section>
    </div>
  );
}

function Property({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-ink-muted">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </>
  );
}

/** A borderless text field that saves when it loses focus (or on Enter, for single-line fields). */
function CommitField({
  label,
  value,
  onCommit,
  multiline = false,
  required = false,
  placeholder,
  className = '',
}: {
  label: string;
  value: string;
  onCommit: (value: string) => void;
  multiline?: boolean;
  /** An empty value is not saved, and the field shows the saved value again. */
  required?: boolean;
  placeholder?: string;
  className?: string;
}) {
  const [draft, setDraft] = useState(value);
  // Follow changes from elsewhere (someone else renamed the task), except while this field is being edited.
  const editing = useRef(false);
  useEffect(() => {
    if (!editing.current) setDraft(value);
  }, [value]);
  // Escape reverts and blurs; that blur must not save the draft being thrown away.
  const discarding = useRef(false);
  const commit = () => {
    editing.current = false;
    if (discarding.current) {
      discarding.current = false;
      return;
    }
    if (required && !draft.trim()) {
      setDraft(value);
      return;
    }
    if (draft !== value) onCommit(draft);
  };
  const shared = `w-full resize-none rounded-control border border-transparent bg-transparent px-2 py-1 -mx-2 outline-none placeholder:text-ink-faint hover:border-line focus:border-line focus-visible:outline-2 focus-visible:outline-marigold ${className}`;

  return (
    <TextField
      aria-label={label}
      value={draft}
      onChange={setDraft}
      onFocus={() => {
        editing.current = true;
      }}
      onBlur={commit}
    >
      {multiline ? (
        <TextArea placeholder={placeholder} className={shared} />
      ) : (
        <Input
          placeholder={placeholder}
          className={shared}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur();
            if (event.key === 'Escape') {
              // Revert and let go of focus; the next Escape closes the panel.
              discarding.current = true;
              setDraft(value);
              event.currentTarget.blur();
            }
          }}
        />
      )}
    </TextField>
  );
}

type LabelOption = { id: string; name: string; color: string };

function LabelPicker({
  options,
  selected,
  onChange,
}: {
  options: LabelOption[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const chosen = options.filter((o) => selected.includes(o.id));
  return (
    <DialogTrigger>
      <AriaButton
        aria-label={`Labels: ${chosen.map((l) => l.name).join(', ') || 'none'}`}
        className="focus-ring flex min-h-9 w-full flex-wrap items-center gap-1.5 rounded-control border border-line bg-surface px-2.5 py-1 text-left text-sm data-[hovered]:border-line-strong"
      >
        {chosen.length === 0 && (
          <span className="flex items-center gap-1.5 text-ink-faint">
            <TagIcon /> Add labels
          </span>
        )}
        {chosen.map((label) => (
          <span
            key={label.id}
            className="inline-flex items-center gap-1 rounded-full bg-raised px-2 py-0.5 text-xs"
          >
            <span
              aria-hidden
              className="size-1.5 rounded-full"
              style={{ backgroundColor: label.color }}
            />
            {label.name}
          </span>
        ))}
      </AriaButton>
      <Popover placement="bottom start" className={`${popover} w-(--trigger-width)`}>
        <Dialog aria-label="Labels" className="outline-none">
          {options.length === 0 ? (
            <p className="p-2 text-ink-muted text-xs">This project has no labels yet.</p>
          ) : (
            <ListBox
              aria-label="Labels"
              selectionMode="multiple"
              selectedKeys={selected}
              onSelectionChange={(keys) =>
                onChange(keys === 'all' ? options.map((o) => o.id) : [...keys].map(String))
              }
              items={options}
              className="outline-none"
              // Escape closes the picker; by default it would also remove every label from the task.
              escapeKeyBehavior="none"
            >
              {(label) => (
                <ListBoxItem
                  id={label.id}
                  textValue={label.name}
                  className="flex cursor-default items-center gap-2 rounded-[4px] px-2 py-1.5 text-sm outline-none data-[focused]:bg-lane data-[selected]:font-medium"
                >
                  {({ isSelected }) => (
                    <>
                      <span
                        aria-hidden
                        className="size-2 rounded-full"
                        style={{ backgroundColor: label.color }}
                      />
                      <span className="flex-1">{label.name}</span>
                      {isSelected && <span className="text-ink-muted text-xs">Added</span>}
                    </>
                  )}
                </ListBoxItem>
              )}
            </ListBox>
          )}
        </Dialog>
      </Popover>
      <Label className="sr-only">Labels</Label>
    </DialogTrigger>
  );
}
