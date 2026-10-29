import { BookmarkSimple, CaretDown, DotsThree, Trash, UsersThree } from '@phosphor-icons/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ListSort, SavedView } from '@teamflow/contract';
import { normalizeFilter, sameFilter, type TaskFilter } from '@teamflow/domain';
import {
  Button,
  Dialog,
  Menu,
  MenuItem,
  MenuSeparator,
  MenuTrigger,
  Switch,
  TextField,
  toast,
} from '@teamflow/ui';
import { useState } from 'react';
import { Form, Header, MenuSection } from 'react-aria-components';
import type { z } from 'zod';
import { orpc } from '../../lib/api.ts';

export type ListState = TaskFilter & {
  sort?: z.infer<typeof ListSort>;
  dir?: 'ascending' | 'descending';
  view?: string;
};

const ALL = '__all__';

export const filterOf = ({ sort: _s, dir: _d, view: _v, ...filter }: ListState): TaskFilter =>
  filter;

/** The view's own state as list search params. */
export const stateOf = (view: SavedView): ListState => ({
  ...normalizeFilter(view.filter),
  sort: view.sort ?? undefined,
  dir: view.direction ?? undefined,
  view: view.id,
});

const differs = (view: SavedView, state: ListState) =>
  !sameFilter(view.filter, filterOf(state)) ||
  (view.sort ?? undefined) !== state.sort ||
  (view.direction ?? undefined) !== state.dir;

/** Pick a saved view, save the current filters as one, and keep a view up to date. */
export function SavedViews({
  projectId,
  state,
  canShare,
  onApply,
}: {
  projectId: string;
  state: ListState;
  canShare: boolean;
  onApply: (state: ListState) => void;
}) {
  const queryClient = useQueryClient();
  const views = useQuery(orpc.views.list.queryOptions({ input: { projectId } }));
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: orpc.views.list.key({ input: { projectId } }) });
  const failed = (title: string) => (error: Error) =>
    toast({ title, description: error.message, tone: 'danger' });
  const update = useMutation(
    orpc.views.update.mutationOptions({ onSuccess: refresh, onError: failed('View not saved') }),
  );
  const remove = useMutation(
    orpc.views.delete.mutationOptions({
      onSuccess: () => {
        void refresh();
        onApply(filterOf({ ...state, view: undefined }));
      },
      onError: failed('View not deleted'),
    }),
  );
  const [saving, setSaving] = useState(false);

  const all = views.data ?? [];
  const current = all.find((v) => v.id === state.view);
  const dirty = current ? differs(current, state) : false;
  const hasState = Object.keys(normalizeFilter(filterOf(state))).length > 0 || !!state.sort;
  const mine = all.filter((v) => v.mine);
  const shared = all.filter((v) => !v.mine && v.shared);

  return (
    <div className="flex items-center gap-1.5">
      <MenuTrigger>
        <Button variant="secondary" size="sm" aria-label={`View: ${current?.name ?? 'All tasks'}`}>
          <BookmarkSimple />
          <span className="max-w-40 truncate">{current?.name ?? 'All tasks'}</span>
          {dirty && <span className="text-ink-faint">· edited</span>}
          <CaretDown className="text-ink-faint" />
        </Button>
        <Menu
          placement="bottom end"
          onAction={(key) => {
            if (key === ALL) return onApply({});
            const view = all.find((v) => v.id === key);
            if (view) onApply(stateOf(view));
          }}
        >
          <MenuItem id={ALL}>All tasks</MenuItem>
          {mine.length > 0 && (
            <MenuSection>
              <Header className="px-2 pt-2 pb-1 text-ink-faint text-xs">Your views</Header>
              {mine.map((v) => (
                <MenuItem
                  key={v.id}
                  id={v.id}
                  textValue={v.name}
                  icon={v.shared ? <UsersThree aria-label="Shared" /> : null}
                >
                  {v.name}
                </MenuItem>
              ))}
            </MenuSection>
          )}
          {shared.length > 0 && (
            <MenuSection>
              <Header className="px-2 pt-2 pb-1 text-ink-faint text-xs">Shared</Header>
              {shared.map((v) => (
                <MenuItem key={v.id} id={v.id} textValue={v.name}>
                  <span className="flex-1 truncate">{v.name}</span>
                  <span className="text-ink-faint text-xs">{v.ownerName}</span>
                </MenuItem>
              ))}
            </MenuSection>
          )}
        </Menu>
      </MenuTrigger>

      {current && dirty && (
        <>
          {current.mine && (
            <Button
              size="sm"
              isPending={update.isPending}
              onPress={() =>
                update.mutate({
                  id: current.id,
                  version: current.version,
                  filter: normalizeFilter(filterOf(state)),
                  sort: state.sort ?? null,
                  direction: state.dir ?? null,
                })
              }
            >
              Save changes
            </Button>
          )}
          <Button variant="quiet" size="sm" onPress={() => onApply(stateOf(current))}>
            Reset
          </Button>
        </>
      )}
      {(current ? dirty : hasState) && (
        <Button variant="quiet" size="sm" onPress={() => setSaving(true)}>
          Save as view…
        </Button>
      )}

      {current && (current.mine || current.canDelete) && (
        <MenuTrigger>
          <Button variant="quiet" size="sm" aria-label="View options" className="size-7 px-0">
            <DotsThree />
          </Button>
          <Menu placement="bottom end">
            {current.mine && canShare && (
              <MenuItem
                icon={<UsersThree />}
                onAction={() =>
                  update.mutate({
                    id: current.id,
                    version: current.version,
                    shared: !current.shared,
                  })
                }
              >
                {current.shared ? 'Make private' : 'Share with workspace'}
              </MenuItem>
            )}
            {current.mine && canShare && current.canDelete && <MenuSeparator />}
            {current.canDelete && (
              <MenuItem
                icon={<Trash />}
                tone="danger"
                onAction={() => remove.mutate({ id: current.id })}
              >
                Delete view
              </MenuItem>
            )}
          </Menu>
        </MenuTrigger>
      )}

      {saving && (
        <SaveViewDialog
          projectId={projectId}
          state={state}
          canShare={canShare}
          onClose={() => setSaving(false)}
          onSaved={(view) => {
            setSaving(false);
            void refresh();
            onApply(stateOf(view));
          }}
        />
      )}
    </div>
  );
}

function SaveViewDialog({
  projectId,
  state,
  canShare,
  onClose,
  onSaved,
}: {
  projectId: string;
  state: ListState;
  canShare: boolean;
  onClose: () => void;
  onSaved: (view: SavedView) => void;
}) {
  const [name, setName] = useState('');
  const [shared, setShared] = useState(false);
  const create = useMutation(orpc.views.create.mutationOptions({ onSuccess: onSaved }));
  return (
    <Dialog isOpen onOpenChange={(open) => !open && onClose()} title="Save view" width="sm">
      <Form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          create.mutate({
            projectId,
            name,
            shared,
            filter: normalizeFilter(filterOf(state)),
            sort: state.sort ?? null,
            direction: state.dir ?? null,
          });
        }}
      >
        <TextField
          label="Name"
          value={name}
          onChange={setName}
          maxLength={60}
          isRequired
          autoFocus
          errorMessage={create.error?.message}
          isInvalid={!!create.error}
        />
        {canShare && (
          <Switch isSelected={shared} onChange={setShared}>
            Share with everyone in the workspace
          </Switch>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="quiet" onPress={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" isPending={create.isPending}>
            Save view
          </Button>
        </div>
      </Form>
    </Dialog>
  );
}
