import { useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Outlet, redirect, useNavigate, useParams } from '@tanstack/react-router';
import { useState } from 'react';
import { CreateProjectDialog } from '../components/create-project-dialog.tsx';
import { MobileBar } from '../components/shell/mobile-bar.tsx';
import { Sidebar } from '../components/shell/sidebar.tsx';
import { CommandPalette } from '../features/command/command-palette.tsx';
import { ShortcutsDialog } from '../features/command/shortcuts-dialog.tsx';
import { orpc } from '../lib/api.ts';
import { authClient } from '../lib/auth.ts';
import { requestCreateTask } from '../lib/events.ts';
import { useChannel } from '../lib/realtime.ts';
import { loadMe, meQuery } from '../lib/session.ts';
import { useShortcuts } from '../lib/shortcuts.ts';

/**
 * Everything behind sign-in. Ensures there is an active organization: picks the first one the user belongs to,
 * or sends them to create one.
 */
export const Route = createFileRoute('/_app')({
  beforeLoad: async ({ context, location }) => {
    const me = await loadMe(context.queryClient);
    if (!me) throw redirect({ to: '/sign-in', search: { redirect: location.href } });

    if (!me.activeOrganizationId) {
      const first = me.organizations[0];
      if (!first) throw redirect({ to: '/onboarding' });
      await authClient.organization.setActive({ organizationId: first.id });
      await context.queryClient.invalidateQueries({ queryKey: meQuery().queryKey });
      return { me: await context.queryClient.fetchQuery(meQuery()) };
    }
    return { me };
  },
  component: AppShell,
});

function AppShell() {
  const { me } = Route.useRouteContext();
  const navigate = useNavigate();
  const params = useParams({ strict: false }) as { key?: string };
  const [creating, setCreating] = useState(false);
  const [palette, setPalette] = useState(false);
  const [help, setHelp] = useState(false);
  const overlayOpen = creating || palette || help;
  const queryClient = useQueryClient();

  // Workspace-wide changes: labels that belong to no project, and the project list itself.
  useChannel('org', (event) => {
    if (event.topic.startsWith('label.'))
      void queryClient.invalidateQueries({ queryKey: orpc.labels.key() });
    if (event.topic.startsWith('project.'))
      void queryClient.invalidateQueries({ queryKey: orpc.projects.key() });
  });

  useShortcuts(
    {
      'mod+k': () => setPalette((open) => !open),
      '/': () => setPalette(true),
      '?': () => setHelp(true),
      'g i': () => navigate({ to: '/inbox' }),
      'g b': () => params.key && navigate({ to: '/p/$key', params: { key: params.key } }),
      'g l': () => params.key && navigate({ to: '/p/$key/list', params: { key: params.key } }),
      'g c': () => params.key && navigate({ to: '/p/$key/calendar', params: { key: params.key } }),
      'g p': () => params.key && navigate({ to: '/p/$key/backlog', params: { key: params.key } }),
      c: () => {
        if (!params.key) return;
        void navigate({ to: '/p/$key', params: { key: params.key } }).then(requestCreateTask);
      },
    },
    !overlayOpen,
  );
  return (
    <div className="flex h-dvh flex-col overflow-hidden md:flex-row">
      <MobileBar me={me} onCreateProject={() => setCreating(true)} />
      <Sidebar me={me} onCreateProject={() => setCreating(true)} className="hidden w-60 md:flex" />
      {/* Workspace pages (inbox, members, audit log, account) scroll here; project views fill it exactly and
          scroll inside their own panes. */}
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto">
        <Outlet />
      </div>
      <CreateProjectDialog isOpen={creating} onOpenChange={setCreating} />
      <CommandPalette
        isOpen={palette}
        onOpenChange={setPalette}
        onCreateProject={() => setCreating(true)}
        onShowShortcuts={() => setHelp(true)}
      />
      <ShortcutsDialog isOpen={help} onOpenChange={setHelp} />
    </div>
  );
}
