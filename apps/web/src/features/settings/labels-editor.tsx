import { Trash } from '@phosphor-icons/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, TextField, toast } from '@teamflow/ui';
import { useState } from 'react';
import { Form, Input } from 'react-aria-components';
import { orpc } from '../../lib/api.ts';
import type { Project } from '../tasks.ts';
import { ColorDot } from './workflow-editor.tsx';

/** Labels for a project: its own, plus the organization-wide ones it can also use. */
export function LabelsEditor({
  project,
  canCreate,
  canDelete,
}: {
  project: Project;
  canCreate: boolean;
  canDelete: boolean;
}) {
  const queryClient = useQueryClient();
  const labels = useQuery(orpc.labels.list.queryOptions({ input: { projectId: project.id } }));
  const refresh = () => queryClient.invalidateQueries({ queryKey: orpc.labels.key() });
  const failed = (title: string) => (error: Error) =>
    toast({ title, description: error.message, tone: 'danger' });
  const update = useMutation(
    orpc.labels.update.mutationOptions({
      onSuccess: refresh,
      onError: failed('Label not changed'),
    }),
  );
  const remove = useMutation(
    orpc.labels.delete.mutationOptions({
      onSuccess: refresh,
      onError: failed('Label not deleted'),
    }),
  );
  const create = useMutation(
    orpc.labels.create.mutationOptions({
      onSuccess: refresh,
      onError: failed('Label not created'),
    }),
  );
  const [name, setName] = useState('');
  const [wide, setWide] = useState(false);

  return (
    <div className="flex flex-col gap-3">
      <ul className="divide-y divide-line rounded-card border border-line bg-surface empty:hidden">
        {labels.data?.map((label) => (
          <li key={label.id} className="flex items-center gap-3 px-3 py-2">
            <ColorDot
              color={label.color}
              label={`Color for ${label.name}`}
              disabled={!canCreate}
              onChange={(color) => update.mutate({ id: label.id, color })}
            />
            <Input
              aria-label={`Name of ${label.name}`}
              defaultValue={label.name}
              readOnly={!canCreate}
              onBlur={(event) => {
                const value = event.target.value.trim();
                if (value && value !== label.name) update.mutate({ id: label.id, name: value });
              }}
              onKeyDown={(event) => event.key === 'Enter' && event.currentTarget.blur()}
              className="min-w-0 flex-1 rounded-control border border-transparent bg-transparent px-2 py-1 text-sm outline-none hover:border-line focus:border-line focus-visible:outline-2 focus-visible:outline-marigold"
            />
            <span className="text-ink-faint text-xs">
              {label.projectId ? 'This project' : 'Whole workspace'}
            </span>
            {canDelete && (
              <Button
                variant="quiet"
                size="icon"
                aria-label={`Delete ${label.name}`}
                onPress={() => remove.mutate({ id: label.id })}
              >
                <Trash />
              </Button>
            )}
          </li>
        ))}
      </ul>
      {labels.data?.length === 0 && <p className="text-ink-muted text-sm">No labels yet.</p>}
      {canCreate && (
        <Form
          className="flex items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (!name.trim()) return;
            create.mutate(
              { projectId: wide ? null : project.id, name: name.trim(), color: '#4f6d8f' },
              { onSuccess: () => setName('') },
            );
          }}
        >
          <TextField label="New label" value={name} onChange={setName} className="flex-1" />
          <label className="flex h-9 items-center gap-2 text-ink-muted text-sm">
            <input
              type="checkbox"
              checked={wide}
              onChange={(e) => setWide(e.target.checked)}
              className="accent-ink"
            />
            Whole workspace
          </label>
          <Button type="submit" isPending={create.isPending}>
            Add label
          </Button>
        </Form>
      )}
    </div>
  );
}
