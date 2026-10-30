import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { Avatar, Button } from '@teamflow/ui';
import { inboxQuery, linkFor, summarize } from '../../features/inbox/inbox.ts';
import { orpc } from '../../lib/api.ts';

export const Route = createFileRoute('/_app/inbox')({ component: Inbox });

const relative = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
function ago(date: Date) {
  const minutes = Math.round((date.getTime() - Date.now()) / 60_000);
  if (Math.abs(minutes) < 60) return relative.format(minutes, 'minute');
  if (Math.abs(minutes) < 1440) return relative.format(Math.round(minutes / 60), 'hour');
  return relative.format(Math.round(minutes / 1440), 'day');
}

function Inbox() {
  const queryClient = useQueryClient();
  const inbox = useQuery(inboxQuery());
  const markRead = useMutation(
    orpc.notifications.markRead.mutationOptions({
      onSuccess: () => queryClient.invalidateQueries({ queryKey: orpc.notifications.key() }),
    }),
  );
  const items = inbox.data?.items ?? [];

  return (
    <main className="w-full p-4">
      <div className="flex items-center justify-between">
        <h1 className="font-semibold text-xl">Inbox</h1>
        {(inbox.data?.unread ?? 0) > 0 && (
          <Button variant="quiet" size="sm" onPress={() => markRead.mutate({ ids: null })}>
            Mark all read
          </Button>
        )}
      </div>
      {items.length === 0 && !inbox.isPending && (
        <p className="mt-8 text-ink-muted text-sm">
          Nothing here yet. When someone assigns you a task, mentions you or comments on your work,
          it shows up here.
        </p>
      )}
      <ul className="mt-6 divide-y divide-line rounded-card border border-line bg-surface empty:hidden">
        {items.map((n) => {
          const link = linkFor(n);
          return (
            <li key={n.id} className="relative">
              {!n.readAt && (
                <span aria-hidden className="absolute top-5 left-2 size-1.5 rounded-full bg-ink" />
              )}
              <Link
                to="/p/$key"
                params={{ key: link?.key ?? '' }}
                search={{ task: link?.task }}
                disabled={!link}
                onClick={() => !n.readAt && markRead.mutate({ ids: [n.id] })}
                className="flex gap-3 px-5 py-3.5 outline-none hover:bg-raised focus-visible:outline-2 focus-visible:outline-marigold focus-visible:-outline-offset-2"
              >
                <Avatar name={n.actorName ?? 'TeamFlow'} src={n.actorImage} size="sm" decorative />
                <span className="min-w-0 flex-1">
                  <span className={`block text-sm ${n.readAt ? 'text-ink-muted' : 'font-medium'}`}>
                    {summarize(n)}
                    {!n.readAt && <span className="sr-only"> (unread)</span>}
                  </span>
                  <span className="block truncate text-ink-muted text-xs">
                    {n.data.excerpt ?? n.data.title}
                  </span>
                </span>
                <time
                  className="shrink-0 text-ink-faint text-xs"
                  dateTime={n.createdAt.toISOString()}
                >
                  {ago(n.createdAt)}
                </time>
              </Link>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
