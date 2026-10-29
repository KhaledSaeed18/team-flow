import { Copy, Key } from '@phosphor-icons/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Dialog, Notice, Select, SelectItem, TextField, toast } from '@teamflow/ui';
import { useState } from 'react';
import { Form } from 'react-aria-components';
import { orpc } from '../../lib/api.ts';

const LIFETIMES = [
  { id: '30', label: '30 days' },
  { id: '90', label: '90 days' },
  { id: '365', label: '1 year' },
  { id: 'never', label: 'Never' },
] as const;
const date = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });

/** Personal access tokens for the public API, scoped to the active workspace. */
export function ApiTokens({ workspace }: { workspace: string }) {
  const queryClient = useQueryClient();
  const tokens = useQuery(orpc.tokens.list.queryOptions());
  const refresh = () => queryClient.invalidateQueries({ queryKey: orpc.tokens.key() });
  const revoke = useMutation(
    orpc.tokens.revoke.mutationOptions({
      onSuccess: refresh,
      onError: (error) =>
        toast({ title: 'Token not revoked', description: error.message, tone: 'danger' }),
    }),
  );
  const [creating, setCreating] = useState(false);
  const [secret, setSecret] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-3">
      <p className="text-ink-muted text-sm">
        Tokens act as you in <strong className="text-ink">{workspace}</strong> on the{' '}
        <a href="/api/docs" className="underline">
          REST API
        </a>
        . Send one as <code className="text-xs">Authorization: Bearer tf_…</code>.
      </p>
      {(tokens.data ?? []).length > 0 && (
        <ul className="divide-y divide-line rounded-card border border-line bg-surface">
          {(tokens.data ?? []).map((token) => (
            <li key={token.id} className="flex items-center gap-3 px-4 py-3">
              <Key aria-hidden className="shrink-0 text-ink-faint" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">
                  {token.name}
                  <span className="ml-2 rounded-full bg-raised px-2 py-0.5 text-ink-muted text-xs">
                    {token.access === 'write' ? 'Read and write' : 'Read only'}
                  </span>
                </p>
                <p className="truncate text-ink-faint text-xs">
                  <code>{token.prefix}</code> ·{' '}
                  {token.lastUsedAt ? `last used ${date.format(token.lastUsedAt)}` : 'never used'} ·{' '}
                  {token.expiresAt ? `expires ${date.format(token.expiresAt)}` : 'never expires'}
                </p>
              </div>
              <Button
                variant="quiet"
                size="sm"
                aria-label={`Revoke ${token.name}`}
                onPress={() => revoke.mutate({ id: token.id })}
              >
                Revoke
              </Button>
            </li>
          ))}
        </ul>
      )}
      <Button size="sm" className="self-start" onPress={() => setCreating(true)}>
        Create token
      </Button>

      {creating && (
        <CreateToken
          onClose={() => setCreating(false)}
          onCreated={(value) => {
            setCreating(false);
            setSecret(value);
            void refresh();
          }}
        />
      )}
      {secret && <ShowSecret secret={secret} onClose={() => setSecret(null)} />}
    </div>
  );
}

function CreateToken({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (secret: string) => void;
}) {
  const [name, setName] = useState('');
  const [access, setAccess] = useState<'read' | 'write'>('read');
  const [lifetime, setLifetime] = useState<(typeof LIFETIMES)[number]['id']>('90');
  const create = useMutation(
    orpc.tokens.create.mutationOptions({ onSuccess: ({ secret }) => onCreated(secret) }),
  );
  return (
    <Dialog isOpen onOpenChange={(open) => !open && onClose()} title="Create API token" width="sm">
      <Form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          create.mutate({
            name,
            access,
            expiresInDays: lifetime === 'never' ? null : (Number(lifetime) as 30 | 90 | 365),
          });
        }}
      >
        {create.error && <Notice tone="danger">{create.error.message}</Notice>}
        <TextField
          label="Name"
          description="What it is for, like “CI” or “Dashboard”."
          value={name}
          onChange={setName}
          maxLength={60}
          isRequired
          autoFocus
        />
        <Select
          label="Access"
          selectedKey={access}
          onSelectionChange={(key) => setAccess(key as 'read' | 'write')}
        >
          <SelectItem id="read">Read only</SelectItem>
          <SelectItem id="write">Read and write</SelectItem>
        </Select>
        <Select
          label="Expires"
          selectedKey={lifetime}
          onSelectionChange={(key) => setLifetime(key as typeof lifetime)}
        >
          {LIFETIMES.map((l) => (
            <SelectItem key={l.id} id={l.id}>
              {l.label}
            </SelectItem>
          ))}
        </Select>
        <div className="flex justify-end gap-2">
          <Button variant="quiet" onPress={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" isPending={create.isPending}>
            Create token
          </Button>
        </div>
      </Form>
    </Dialog>
  );
}

function ShowSecret({ secret, onClose }: { secret: string; onClose: () => void }) {
  const example = `curl -H "Authorization: Bearer ${secret}" ${window.location.origin}/api/v1/projects`;
  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    toast({ title: 'Copied' });
  };
  return (
    <Dialog isOpen onOpenChange={(open) => !open && onClose()} title="Your new token" width="md">
      <div className="flex flex-col gap-4">
        <Notice>Copy it now. You will not be able to see it again.</Notice>
        <div className="flex items-end gap-2">
          <TextField label="Token" value={secret} isReadOnly className="min-w-0 flex-1 font-mono" />
          <Button size="sm" aria-label="Copy token" onPress={() => copy(secret)}>
            <Copy /> Copy
          </Button>
        </div>
        <div>
          <p className="mb-1 text-ink-muted text-xs">Try it:</p>
          <pre className="overflow-x-auto rounded-control bg-raised p-2.5 text-xs">{example}</pre>
        </div>
        <div className="flex justify-end">
          <Button variant="primary" onPress={onClose}>
            Done
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
