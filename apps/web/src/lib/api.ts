import { createORPCClient, onError } from '@orpc/client';
import { RPCLink } from '@orpc/client/fetch';
import { createTanstackQueryUtils } from '@orpc/tanstack-query';
import { QueryClient } from '@tanstack/react-query';
import type { Client } from '@teamflow/contract';

const link = new RPCLink({
  url: () => `${window.location.origin}/rpc`,
  fetch: (request, init) => fetch(request, { ...init, credentials: 'include' }),
  interceptors: [
    onError((error) => {
      if ((error as { name?: string }).name !== 'AbortError') console.error(error);
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
