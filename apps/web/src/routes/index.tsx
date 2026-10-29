import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { Spinner } from '@teamflow/ui';
import { orpc } from '../lib/api.ts';

export const Route = createFileRoute('/')({ component: Home });

function Home() {
  const me = useQuery(orpc.me.get.queryOptions());
  return (
    <main className="grid min-h-dvh place-items-center">
      {me.isPending ? (
        <Spinner />
      ) : (
        <p className="text-ink-muted text-sm">{me.data?.user.name ?? 'Signed out'}</p>
      )}
    </main>
  );
}
