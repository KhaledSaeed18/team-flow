import type { QueryClient } from '@tanstack/react-query';
import type { Outputs } from '@teamflow/contract';
import { orpc } from './api.ts';

export type Me = Outputs['me']['get'];

export const meQuery = () => orpc.me.get.queryOptions({ retry: false, staleTime: 60_000 });

/** The signed-in user, or `null` when signed out. */
export async function loadMe(queryClient: QueryClient): Promise<Me | null> {
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
