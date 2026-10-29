import { isDefinedError } from '@orpc/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { suggestProjectKey } from '@teamflow/domain';
import { Button, Dialog, Notice, TextField } from '@teamflow/ui';
import { useState } from 'react';
import { Form, Label, Radio, RadioGroup } from 'react-aria-components';
import { orpc } from '../lib/api.ts';

export const PROJECT_COLORS = [
  ['#4f6d8f', 'Slate blue'],
  ['#5d7d5a', 'Moss'],
  ['#8a5a7a', 'Plum'],
  ['#b0723a', 'Copper'],
  ['#4f7f80', 'Teal'],
  ['#6b5f99', 'Iris'],
  ['#9b4f4f', 'Brick'],
] as const;

export function CreateProjectDialog({
  isOpen,
  onOpenChange,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [key, setKey] = useState('');
  const [keyEdited, setKeyEdited] = useState(false);
  const [color, setColor] = useState<string>(PROJECT_COLORS[0][0]);

  const create = useMutation(
    orpc.projects.create.mutationOptions({
      onSuccess: async (project) => {
        await queryClient.invalidateQueries({ queryKey: orpc.projects.key() });
        onOpenChange(false);
        setName('');
        setKey('');
        setKeyEdited(false);
        await navigate({ to: '/p/$key', params: { key: project.key } });
      },
    }),
  );

  const keyTaken = isDefinedError(create.error) && create.error.code === 'KEY_TAKEN';

  return (
    <Dialog isOpen={isOpen} onOpenChange={onOpenChange} title="New project">
      {({ close }) => (
        <Form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            create.mutate({ name, key, color });
          }}
          validationErrors={keyTaken ? { key: 'Another project already uses this key.' } : {}}
        >
          {create.error && !keyTaken && <Notice tone="danger">{create.error.message}</Notice>}
          <TextField
            label="Name"
            name="name"
            value={name}
            onChange={(value) => {
              setName(value);
              if (!keyEdited) setKey(value.trim() ? suggestProjectKey(value) : '');
            }}
            isRequired
            autoFocus
          />
          <TextField
            label="Key"
            name="key"
            description={
              key
                ? `Tasks will be numbered ${key}-1, ${key}-2, …`
                : 'A short prefix for task numbers.'
            }
            value={key}
            onChange={(value) => {
              setKey(
                value
                  .toUpperCase()
                  .replace(/[^A-Z0-9]/g, '')
                  .slice(0, 6),
              );
              setKeyEdited(true);
            }}
            pattern="[A-Z][A-Z0-9]{1,5}"
            isRequired
          />
          <RadioGroup
            value={color}
            onChange={setColor}
            orientation="horizontal"
            className="flex flex-col gap-1.5"
          >
            <Label className="font-medium text-sm">Color</Label>
            <div className="flex gap-2">
              {PROJECT_COLORS.map(([value, label]) => (
                <Radio
                  key={value}
                  value={value}
                  aria-label={label}
                  className="focus-ring size-7 rounded-full border-2 border-transparent data-[selected]:border-ink"
                >
                  <span
                    className="m-0.5 block size-5 rounded-full"
                    style={{ backgroundColor: value }}
                  />
                </Radio>
              ))}
            </div>
          </RadioGroup>
          <div className="mt-2 flex justify-end gap-2">
            <Button variant="quiet" onPress={close}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isPending={create.isPending}>
              Create project
            </Button>
          </div>
        </Form>
      )}
    </Dialog>
  );
}
