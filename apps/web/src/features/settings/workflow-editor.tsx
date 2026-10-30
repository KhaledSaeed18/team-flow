import { DotsSixVertical, Trash } from '@phosphor-icons/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { STATUS_CATEGORIES, type StatusCategory } from '@teamflow/domain';
import { Button, Dialog, Select, SelectItem, TextField, toast } from '@teamflow/ui';
import { useEffect, useRef, useState } from 'react';
import {
  Button as AriaButton,
  Form,
  GridList,
  GridListItem,
  Input,
  useDragAndDrop,
} from 'react-aria-components';
import { PROJECT_COLORS } from '../../components/create-project-dialog.tsx';
import { orpc } from '../../lib/api.ts';
import type { Project } from '../tasks.ts';

type Status = Project['statuses'][number];

export const CATEGORY_LABEL: Record<StatusCategory, string> = {
  backlog: 'Backlog',
  unstarted: 'To do',
  started: 'In progress',
  completed: 'Done',
  canceled: 'Canceled',
};

const STATUS_TYPE = 'application/x-teamflow-status';

/**
 * Edit a project's workflow: rename, recolor and re-type statuses, drag to reorder, add, and delete (moving the
 * status's tasks to another of the same type). The server enforces the invariants and explains refusals.
 */
export function WorkflowEditor({ project, canEdit }: { project: Project; canEdit: boolean }) {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: orpc.projects.key() });
  const failed = (title: string) => (error: Error) =>
    toast({ title, description: error.message, tone: 'danger' });
  const update = useMutation(
    orpc.workflow.updateStatus.mutationOptions({
      onSuccess: refresh,
      onError: failed('Status not changed'),
    }),
  );
  const create = useMutation(
    orpc.workflow.createStatus.mutationOptions({
      onSuccess: refresh,
      onError: failed('Status not added'),
    }),
  );
  const [deleting, setDeleting] = useState<Status | null>(null);
  const [name, setName] = useState('');
  const [category, setCategory] = useState<StatusCategory>('started');

  const { dragAndDropHooks } = useDragAndDrop<Status>({
    isDisabled: !canEdit,
    getItems: (keys) =>
      [...keys].map((key) => ({ [STATUS_TYPE]: String(key), 'text/plain': String(key) })),
    acceptedDragTypes: [STATUS_TYPE],
    getDropOperation: () => 'move',
    onReorder: (event) => {
      const [id] = event.keys;
      if (id === undefined) return;
      const others = project.statuses.filter((s) => s.id !== id);
      const target = others.findIndex((s) => s.id === event.target.key);
      const after =
        event.target.dropPosition === 'before'
          ? (others[target - 1]?.id ?? null)
          : String(event.target.key);
      update.mutate({ id: String(id), afterId: after });
    },
  });

  return (
    <div className="flex flex-col gap-3">
      <GridList
        aria-label="Workflow statuses"
        items={project.statuses}
        // Rows hold text fields: Tab moves between controls so arrow keys can move the caret.
        keyboardNavigationBehavior="tab"
        dragAndDropHooks={dragAndDropHooks}
        className="flex flex-col divide-y divide-line overflow-hidden rounded-card border border-line bg-surface outline-none"
      >
        {(status) => (
          <GridListItem
            id={status.id}
            textValue={status.name}
            className="flex items-center gap-3 px-3 py-2 outline-none data-[focus-visible]:outline-2 data-[focus-visible]:outline-marigold data-[focus-visible]:-outline-offset-2"
          >
            {canEdit && (
              <AriaButton
                slot="drag"
                aria-label={`Reorder ${status.name}`}
                className="rounded-[4px] p-0.5 text-ink-faint outline-none data-[focus-visible]:outline-2 data-[focus-visible]:outline-marigold"
              >
                <DotsSixVertical />
              </AriaButton>
            )}
            <ColorDot
              color={status.color}
              label={`Color for ${status.name}`}
              disabled={!canEdit}
              onChange={(color) => update.mutate({ id: status.id, color })}
            />
            <StatusName
              name={status.name}
              readOnly={!canEdit}
              onRename={(name, onFailed) =>
                update.mutate({ id: status.id, name }, { onError: onFailed })
              }
            />
            <div className="w-32 shrink-0 sm:w-36">
              <Select
                aria-label={`Type of ${status.name}`}
                selectedKey={status.category}
                isDisabled={!canEdit}
                onSelectionChange={(key) =>
                  update.mutate({ id: status.id, category: key as StatusCategory })
                }
              >
                {STATUS_CATEGORIES.map((c) => (
                  <SelectItem key={c} id={c}>
                    {CATEGORY_LABEL[c]}
                  </SelectItem>
                ))}
              </Select>
            </div>
            {canEdit && (
              <Button
                variant="quiet"
                size="icon"
                aria-label={`Delete ${status.name}`}
                onPress={() => setDeleting(status)}
              >
                <Trash />
              </Button>
            )}
          </GridListItem>
        )}
      </GridList>

      {canEdit && (
        <Form
          className="flex flex-wrap items-end gap-2 sm:flex-nowrap"
          onSubmit={(event) => {
            event.preventDefault();
            if (!name.trim()) return;
            create.mutate(
              { projectId: project.id, name: name.trim(), category, color: '#64748b' },
              { onSuccess: () => setName('') },
            );
          }}
        >
          <TextField
            label="New status"
            value={name}
            onChange={setName}
            className="min-w-0 basis-full sm:flex-1 sm:basis-auto"
          />
          <div className="w-32 shrink-0 sm:w-36">
            <Select
              label="Type"
              selectedKey={category}
              onSelectionChange={(key) => setCategory(key as StatusCategory)}
            >
              {STATUS_CATEGORIES.map((c) => (
                <SelectItem key={c} id={c}>
                  {CATEGORY_LABEL[c]}
                </SelectItem>
              ))}
            </Select>
          </div>
          <Button type="submit" isPending={create.isPending}>
            Add status
          </Button>
        </Form>
      )}

      {deleting && (
        <DeleteStatus project={project} status={deleting} onClose={() => setDeleting(null)} />
      )}
    </div>
  );
}

function DeleteStatus({
  project,
  status,
  onClose,
}: {
  project: Project;
  status: Status;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const sameType = project.statuses.filter(
    (s) => s.id !== status.id && s.category === status.category,
  );
  const [target, setTarget] = useState(sameType[0]?.id ?? '');
  const remove = useMutation(
    orpc.workflow.deleteStatus.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: orpc.projects.key() });
        void queryClient.invalidateQueries({ queryKey: orpc.tasks.key() });
        onClose();
      },
      onError: (error) =>
        toast({ title: 'Status not deleted', description: error.message, tone: 'danger' }),
    }),
  );
  return (
    <Dialog
      isOpen
      onOpenChange={(open) => !open && onClose()}
      title={`Delete ${status.name}`}
      width="sm"
    >
      {sameType.length === 0 ? (
        <p className="text-ink-muted text-sm">
          This is the only {CATEGORY_LABEL[status.category].toLowerCase()} status. Add another one
          of that type first, so its tasks have somewhere to go.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          <Select
            label="Move its tasks to"
            selectedKey={target}
            onSelectionChange={(key) => setTarget(String(key))}
          >
            {sameType.map((s) => (
              <SelectItem key={s.id} id={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </Select>
          <div className="flex justify-end gap-2">
            <Button variant="quiet" onPress={onClose}>
              Cancel
            </Button>
            <Button
              variant="danger"
              isPending={remove.isPending}
              onPress={() => remove.mutate({ id: status.id, moveTasksTo: target })}
            >
              Delete status
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}

/** A color swatch that opens a small palette. */
export function ColorDot({
  color,
  label,
  disabled = false,
  onChange,
}: {
  color: string;
  label: string;
  disabled?: boolean;
  onChange: (color: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <AriaButton
        aria-label={label}
        isDisabled={disabled}
        onPress={() => setOpen(true)}
        className="size-4 shrink-0 rounded-full outline-none ring-offset-2 data-[focus-visible]:ring-2 data-[focus-visible]:ring-marigold"
        style={{ backgroundColor: color }}
      />
      <Dialog isOpen={open} onOpenChange={setOpen} title={label} width="sm">
        <div className="flex flex-wrap gap-2">
          {[
            ...PROJECT_COLORS,
            ['#94a3b8', 'Slate'],
            ['#f59e0b', 'Amber'],
            ['#22c55e', 'Green'],
            ['#ef4444', 'Red'],
          ].map(([value, name]) => (
            <AriaButton
              key={value}
              aria-label={name}
              onPress={() => {
                onChange(value);
                setOpen(false);
              }}
              className="size-8 rounded-full outline-none ring-offset-2 data-[focus-visible]:ring-2 data-[focus-visible]:ring-marigold"
              style={{ backgroundColor: value }}
            />
          ))}
        </div>
      </Dialog>
    </>
  );
}

/**
 * A status name edited in place. It follows renames made elsewhere (unless it is being edited), and a rename the
 * server refuses (a taken name) puts the saved name back instead of leaving the rejected text in the field.
 */
function StatusName({
  name,
  readOnly,
  onRename,
}: {
  name: string;
  readOnly: boolean;
  onRename: (name: string, onFailed: () => void) => void;
}) {
  const [draft, setDraft] = useState(name);
  const editing = useRef(false);
  useEffect(() => {
    if (!editing.current) setDraft(name);
  }, [name]);
  return (
    <Input
      aria-label={`Name of ${name}`}
      value={draft}
      readOnly={readOnly}
      onChange={(event) => setDraft(event.target.value)}
      onFocus={() => {
        editing.current = true;
      }}
      onBlur={() => {
        editing.current = false;
        const value = draft.trim();
        if (!value || value === name) {
          setDraft(name);
          return;
        }
        onRename(value, () => setDraft(name));
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur();
        if (event.key === 'Escape') {
          setDraft(name);
          editing.current = false;
        }
      }}
      className="min-w-0 flex-1 rounded-control border border-transparent bg-transparent px-2 py-1 text-sm outline-none hover:border-line focus:border-line focus-visible:outline-2 focus-visible:outline-marigold"
    />
  );
}
