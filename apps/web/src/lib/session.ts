import type { QueryClient } from '@tanstack/react-query';
import type { Outputs } from '@teamflow/contract';
import { orpc } from './api.ts';
import { authClient } from './auth.ts';

export type Me = Outputs['me']['get'];

export const meQuery = () => orpc.me.get.queryOptions({ retry: false, staleTime: 60_000 });

/** The signed-in user, or `null` when signed out. */
export async function loadMe(queryClient: QueryClient): Promise<Me | null> {
  // Signed out (the sign-in and sign-up pages): ask Better Auth, which answers 200 with no session, instead of
  // letting `/rpc/me` fail with a 401 the browser logs on every visit.
  if (!queryClient.getQueryData(meQuery().queryKey)) {
    const session = await authClient.getSession();
    if (!session.data) return null;
  }
  try {
    return await queryClient.ensureQueryData(meQuery());
  } catch (error) {
    if ((error as { code?: string }).code === 'UNAUTHORIZED') return null;
    throw error;
  }
}

/** Drop everything cached for the previous user or organization. */
export function resetSession(queryClient: QueryClient) {
  queryClient.clear();
}
