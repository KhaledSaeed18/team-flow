import { type ErrorComponentProps, useRouter } from '@tanstack/react-router';
import { Button } from '@teamflow/ui';

/**
 * Shown in place of a route whose data failed to load. It renders where that route would have, so the sidebar
 * and the project header around it stay, and "Try again" reloads only what failed.
 */
export function RouteError({ error, reset }: ErrorComponentProps) {
  const router = useRouter();
  const offline = typeof navigator !== 'undefined' && !navigator.onLine;
  const status = (error as { status?: number }).status;
  return (
    <div role="alert" className="grid h-full min-h-64 place-items-center p-8">
      <div className="max-w-sm text-center">
        <h1 className="font-semibold text-lg">This page could not be loaded</h1>
        <p className="mt-2 text-ink-muted text-sm">
          {offline
            ? 'You seem to be offline. Check your connection, then try again.'
            : status === 403
              ? 'You do not have access to this.'
              : 'Something went wrong on our side, or the connection dropped. Trying again usually helps.'}
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <Button variant="quiet" onPress={() => window.history.back()}>
            Go back
          </Button>
          <Button
            variant="primary"
            onPress={() => {
              reset();
              void router.invalidate();
            }}
          >
            Try again
          </Button>
        </div>
      </div>
    </div>
  );
}
