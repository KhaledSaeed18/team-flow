import { createORPCClient, onError } from '@orpc/client';
import { RPCLink } from '@orpc/client/fetch';
import { createTanstackQueryUtils } from '@orpc/tanstack-query';
import { QueryClient } from '@tanstack/react-query';
import type { Client } from '@teamflow/contract';

// Requests cut off by a reload or navigation fail with a truncated body; that is not an error worth reporting.
let leaving = false;
window.addEventListener('pagehide', () => {
  leaving = true;
});
window.addEventListener('pageshow', () => {
  leaving = false;
});

/**
 * Errors the app expects and handles itself: signed out, or a request that was cancelled. A query cancelled while
 * its body is still arriving (TanStack Query does this when the same query is invalidated twice) surfaces as a
 * body parse error, so the request's own signal is the reliable test.
 */
const expected = (error: unknown, signal: AbortSignal | undefined) => {
  const { name, code, defined } = error as { name?: string; code?: string; defined?: boolean };
  // Errors the contract declares (a taken name, a stale version, …) are shown by the screen that caused them.
  return (
    leaving ||
    signal?.aborted ||
    name === 'AbortError' ||
    code === 'UNAUTHORIZED' ||
    defined === true
  );
};

const link = new RPCLink({
  url: () => `${window.location.origin}/rpc`,
  fetch: (request, init) => fetch(request, { ...init, credentials: 'include' }),
  interceptors: [
    onError((error, options) => {
      const { signal } = options as { signal?: AbortSignal };
      if (!expected(error, signal)) console.error(error);
    }),
  ],
});

export const client: Client = createORPCClient(link);

/** Typed TanStack Query helpers for every procedure: `orpc.tasks.list.queryOptions({ input })`. */
export const orpc = createTanstackQueryUtils(client);

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (count, error) => count < 2 && (error as { status?: number }).status === undefined,
    },
  },
});
