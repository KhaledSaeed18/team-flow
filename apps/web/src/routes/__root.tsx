import type { QueryClient } from '@tanstack/react-query';
import { createRootRouteWithContext, Outlet, useNavigate, useRouter } from '@tanstack/react-router';
import { Button } from '@teamflow/ui';
import { RouterProvider as AriaRouterProvider } from 'react-aria-components';

export interface RouterContext {
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: Root,
  notFoundComponent: NotFound,
});

function Root() {
  const navigate = useNavigate();
  const router = useRouter();
  return (
    // React Aria links navigate through TanStack Router.
    <AriaRouterProvider
      navigate={(to) => navigate({ to })}
      useHref={(to) => router.buildLocation({ to }).href}
    >
      <Outlet />
    </AriaRouterProvider>
  );
}

function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center p-8">
      <div className="max-w-sm text-center">
        <h1 className="font-semibold text-xl">This page does not exist</h1>
        <p className="mt-2 text-ink-muted text-sm">
          The link may be old, or the task may have been deleted.
        </p>
        <Button className="mt-6" variant="primary" onPress={() => window.history.back()}>
          Go back
        </Button>
      </div>
    </main>
  );
}
