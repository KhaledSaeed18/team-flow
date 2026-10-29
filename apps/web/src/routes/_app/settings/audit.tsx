import { useInfiniteQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { can } from '@teamflow/auth/permissions';
import { Avatar, Button, Notice } from '@teamflow/ui';
import { narrateAudit, standsAlone } from '../../../features/audit/narrate.ts';
import { orpc } from '../../../lib/api.ts';

export const Route = createFileRoute('/_app/settings/audit')({ component: AuditLog });

const day = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
const time = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });

function AuditLog() {
  const { me } = Route.useRouteContext();
  const role = me.organizations.find((o) => o.id === me.activeOrganizationId)?.role ?? 'guest';
  const allowed = can(role, { audit: ['read'] });
  const log = useInfiniteQuery({
    ...orpc.audit.list.infiniteOptions({
      input: (before: string | undefined) => ({ limit: 50, ...(before ? { before } : {}) }),
      initialPageParam: undefined,
      getNextPageParam: (page) => page.nextBefore ?? undefined,
    }),
    enabled: allowed,
  });

  const entries = log.data?.pages.flatMap((p) => p.entries) ?? [];
  const days = new Map<string, typeof entries>();
  for (const entry of entries) {
    const label = day.format(entry.createdAt);
    days.set(label, [...(days.get(label) ?? []), entry]);
  }

  return (
    <main className="mx-auto w-full max-w-3xl p-8">
      <h1 className="font-semibold text-xl">Audit log</h1>
      <p className="mt-1 text-ink-muted text-sm">
        Who changed what in this workspace: people, projects, workflows, labels, sprints and API
        tokens. Changes to individual tasks are in each task’s history.
      </p>

      {!allowed ? (
        <div className="mt-6">
          <Notice>Only admins and owners can see the audit log.</Notice>
        </div>
      ) : (
        <div className="mt-8 flex flex-col gap-8">
          {log.isSuccess && entries.length === 0 && (
            <p className="text-ink-muted text-sm">Nothing has happened yet.</p>
          )}
          {[...days].map(([label, items]) => (
            <section key={label} aria-label={label}>
              <h2 className="mb-2 font-medium text-ink-muted text-xs">{label}</h2>
              <ol className="divide-y divide-line rounded-card border border-line bg-surface">
                {items.map((entry) => (
                  <li key={entry.id} className="flex items-start gap-3 px-4 py-3 text-sm">
                    <Avatar name={entry.actorName ?? '?'} size="sm" decorative />
                    <p className="min-w-0 flex-1 leading-relaxed">
                      {!standsAlone(entry.kind) && (
                        <span className="font-medium">{entry.actorName ?? 'A former member'} </span>
                      )}
                      <span className="text-ink-muted">{narrateAudit(entry)}</span>
                    </p>
                    <time
                      dateTime={entry.createdAt.toISOString()}
                      className="shrink-0 text-ink-faint text-xs"
                    >
                      {time.format(entry.createdAt)}
                    </time>
                  </li>
                ))}
              </ol>
            </section>
          ))}
          {log.hasNextPage && (
            <Button
              className="self-center"
              isPending={log.isFetchingNextPage}
              onPress={() => log.fetchNextPage()}
            >
              Load older
            </Button>
          )}
        </div>
      )}
    </main>
  );
}
