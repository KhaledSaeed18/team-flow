import {
  ArrowRight,
  Kanban,
  ListChecks,
  Moon,
  Plus,
  SignOut,
  Sun,
  Tray,
  UserCircle,
  UsersThree,
} from '@phosphor-icons/react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { Kbd } from '@teamflow/ui';
import { type ReactNode, useDeferredValue, useMemo, useState } from 'react';
import {
  Autocomplete,
  Collection,
  Dialog,
  Header,
  Input,
  Menu,
  MenuItem,
  MenuSection,
  Modal,
  ModalOverlay,
  SearchField,
} from 'react-aria-components';
import { orpc } from '../../lib/api.ts';
import { authClient } from '../../lib/auth.ts';
import { resetSession } from '../../lib/session.ts';
import { shortcutKeys } from '../../lib/shortcuts.ts';
import { setTheme, useTheme } from '../../lib/theme.ts';

interface Item {
  id: string;
  label: string;
  hint?: string;
  /** A second line, e.g. the comment a search matched. */
  detail?: string | null;
  icon: ReactNode;
  shortcut?: string;
  run: () => void;
}

interface Group {
  id: string;
  title: string;
  items: Item[];
}

const matches = (text: string, query: string) =>
  text.toLowerCase().includes(query.trim().toLowerCase());

/**
 * ⌘K: one place to jump anywhere or do anything. Tasks come from server-side search as you type; projects and
 * actions are filtered locally. Arrow keys move, Enter runs, Escape closes.
 */
export function CommandPalette({
  isOpen,
  onOpenChange,
  onCreateProject,
  onShowShortcuts,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateProject: () => void;
  onShowShortcuts: () => void;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const theme = useTheme();
  const [query, setQuery] = useState('');
  const deferred = useDeferredValue(query.trim());
  const projects = useQuery(orpc.projects.list.queryOptions({ input: {} }));
  const tasks = useQuery({
    ...orpc.search.tasks.queryOptions({ input: { q: deferred, limit: 8 } }),
    enabled: isOpen && deferred.length > 0,
    placeholderData: (previous) => previous,
  });

  const close = () => {
    onOpenChange(false);
    setQuery('');
  };

  const groups = useMemo<Group[]>(() => {
    const actions: Item[] = [
      { id: 'new-project', label: 'New project', icon: <Plus />, run: onCreateProject },
      {
        id: 'inbox',
        label: 'Go to inbox',
        icon: <Tray />,
        shortcut: 'g i',
        run: () => navigate({ to: '/inbox' }),
      },
      {
        id: 'members',
        label: 'Go to members',
        icon: <UsersThree />,
        run: () => navigate({ to: '/settings/members' }),
      },
      {
        id: 'account',
        label: 'Go to account settings',
        icon: <UserCircle />,
        run: () => navigate({ to: '/settings/account' }),
      },
      {
        id: 'theme',
        label: theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme',
        icon: theme === 'dark' ? <Sun /> : <Moon />,
        run: () => setTheme(theme === 'dark' ? 'light' : 'dark'),
      },
      {
        id: 'shortcuts',
        label: 'Keyboard shortcuts',
        icon: <ListChecks />,
        shortcut: '?',
        run: onShowShortcuts,
      },
      {
        id: 'sign-out',
        label: 'Sign out',
        icon: <SignOut />,
        run: async () => {
          await authClient.signOut();
          resetSession(queryClient);
          window.location.assign('/sign-in');
        },
      },
    ];
    const projectItems: Item[] = (projects.data ?? []).flatMap((p) => [
      {
        id: `board-${p.id}`,
        label: `${p.name} board`,
        hint: p.key,
        icon: <Kanban style={{ color: p.color }} />,
        run: () => navigate({ to: '/p/$key', params: { key: p.key } }),
      },
      {
        id: `planning-${p.id}`,
        label: `${p.name} planning`,
        hint: p.key,
        icon: <ArrowRight />,
        run: () => navigate({ to: '/p/$key/backlog', params: { key: p.key } }),
      },
    ]);
    const taskItems: Item[] = deferred
      ? (tasks.data ?? []).map((t) => ({
          id: `task-${t.id}`,
          label: t.title,
          hint: `${t.identifier}, ${t.statusName}`,
          detail: t.commentExcerpt && `In a comment: “${t.commentExcerpt}”`,
          icon: (
            <span className="size-2 rounded-full" style={{ backgroundColor: t.projectColor }} />
          ),
          run: () =>
            navigate({
              to: '/p/$key',
              params: { key: t.projectKey },
              search: { task: t.identifier },
            }),
        }))
      : [];

    return [
      { id: 'tasks', title: 'Tasks', items: taskItems },
      {
        id: 'projects',
        title: 'Projects',
        items: projectItems.filter((i) => !query || matches(`${i.label} ${i.hint}`, query)),
      },
      {
        id: 'actions',
        title: 'Actions',
        items: actions.filter((i) => !query || matches(i.label, query)),
      },
    ].filter((g) => g.items.length > 0);
  }, [
    projects.data,
    tasks.data,
    deferred,
    query,
    theme,
    navigate,
    queryClient,
    onCreateProject,
    onShowShortcuts,
  ]);

  const byId = new Map(groups.flatMap((g) => g.items).map((i) => [i.id, i]));

  return (
    <ModalOverlay
      isOpen={isOpen}
      onOpenChange={(open) => (open ? onOpenChange(true) : close())}
      isDismissable
      className="fixed inset-0 z-50 flex items-start justify-center bg-ink/30 p-4 pt-[14vh] data-[entering]:animate-fade-in"
    >
      <Modal className="w-full max-w-xl overflow-hidden rounded-lane border border-line bg-surface shadow-lifted">
        <Dialog aria-label="Command menu" className="outline-none">
          <Autocomplete inputValue={query} onInputChange={setQuery}>
            <SearchField
              aria-label="Search tasks, projects and actions"
              autoFocus
              className="border-line border-b"
            >
              <Input
                placeholder="Search tasks, projects and actions…"
                className="h-12 w-full bg-transparent px-4 text-sm outline-none placeholder:text-ink-faint [&::-webkit-search-cancel-button]:hidden"
              />
            </SearchField>
            <Menu
              aria-label="Results"
              items={groups}
              onAction={(key) => {
                const item = byId.get(String(key));
                close();
                item?.run();
              }}
              renderEmptyState={() => (
                <p className="px-4 py-8 text-center text-ink-muted text-sm">
                  {tasks.isFetching ? 'Searching…' : `Nothing matches “${query}”.`}
                </p>
              )}
              className="max-h-[50vh] overflow-y-auto p-1.5 outline-none"
            >
              {(group) => (
                <MenuSection id={group.id} className="pb-1">
                  <Header className="px-2.5 pt-2 pb-1 font-medium text-2xs text-ink-faint">
                    {group.title}
                  </Header>
                  <Collection items={group.items}>
                    {(item: Item) => (
                      <MenuItem
                        id={item.id}
                        textValue={item.label}
                        className="flex cursor-default items-center gap-2.5 rounded-control px-2.5 py-2 text-sm outline-none data-[focused]:bg-lane"
                      >
                        <span
                          aria-hidden
                          className="flex size-4 items-center justify-center text-ink-muted"
                        >
                          {item.icon}
                        </span>
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className="truncate">{item.label}</span>
                          {item.detail && (
                            <span className="truncate text-ink-faint text-xs">{item.detail}</span>
                          )}
                        </span>
                        {item.hint && <span className="text-ink-faint text-xs">{item.hint}</span>}
                        {item.shortcut && (
                          <span className="flex gap-0.5">
                            {shortcutKeys(item.shortcut).map((k) => (
                              <Kbd key={k}>{k}</Kbd>
                            ))}
                          </span>
                        )}
                      </MenuItem>
                    )}
                  </Collection>
                </MenuSection>
              )}
            </Menu>
          </Autocomplete>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}
