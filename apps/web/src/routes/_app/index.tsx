import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_app/')({ component: Home });

function Home() {
  const { me } = Route.useRouteContext();
  const org = me.organizations.find((o) => o.id === me.activeOrganizationId);
  return (
    <main className="p-8">
      <h1 className="font-semibold text-xl">{org?.name}</h1>
      <p className="mt-1 text-ink-muted text-sm">Signed in as {me.user.name}</p>
    </main>
  );
}
