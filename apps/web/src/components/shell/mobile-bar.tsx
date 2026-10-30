import { List, Tray } from '@phosphor-icons/react';
import { Link, useRouterState } from '@tanstack/react-router';
import { Button } from '@teamflow/ui';
import { useEffect, useState } from 'react';
import { Dialog, Modal, ModalOverlay } from 'react-aria-components';
import { useInbox } from '../../features/inbox/inbox.ts';
import type { Me } from '../../lib/session.ts';
import { Logo } from '../logo.tsx';
import { Sidebar } from './sidebar.tsx';

/** Below the `md` breakpoint the sidebar folds into a drawer opened from this bar. */
export function MobileBar({ me, onCreateProject }: { me: Me; onCreateProject: () => void }) {
  const [open, setOpen] = useState(false);
  const unread = useInbox().data?.unread ?? 0;
  const location = useRouterState({ select: (s) => s.location.href });

  // Following a link in the drawer closes it.
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs on navigation only
  useEffect(() => setOpen(false), [location]);

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-line border-b bg-canvas px-2 md:hidden">
      <Button
        variant="quiet"
        size="icon"
        aria-label="Open navigation"
        onPress={() => setOpen(true)}
      >
        <List />
      </Button>
      <Link
        to="/"
        className="rounded-control outline-none focus-visible:outline-2 focus-visible:outline-marigold"
      >
        <Logo />
      </Link>
      <span className="flex-1" />
      <Link
        to="/inbox"
        aria-label={unread > 0 ? `Inbox, ${unread} unread` : 'Inbox'}
        className="relative flex size-9 items-center justify-center rounded-control text-ink-muted outline-none hover:bg-lane hover:text-ink focus-visible:outline-2 focus-visible:outline-marigold"
      >
        <Tray className="size-5" aria-hidden />
        {unread > 0 && (
          <span
            aria-hidden
            className="absolute top-1.5 right-1.5 size-2 rounded-full bg-marigold"
          />
        )}
      </Link>
      <ModalOverlay
        isOpen={open}
        onOpenChange={setOpen}
        isDismissable
        className="fixed inset-0 z-50 bg-ink/30 data-[entering]:animate-fade-in data-[exiting]:animate-fade-out"
      >
        <Modal className="h-full w-72 max-w-[85vw] animate-drawer-in shadow-lifted">
          <Dialog aria-label="Navigation" className="h-full outline-none">
            <Sidebar me={me} onCreateProject={onCreateProject} className="flex w-full" />
          </Dialog>
        </Modal>
      </ModalOverlay>
    </header>
  );
}
