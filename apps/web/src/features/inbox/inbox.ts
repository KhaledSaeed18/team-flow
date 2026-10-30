import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Outputs } from '@teamflow/contract';
import { toast } from '@teamflow/ui';
import { orpc } from '../../lib/api.ts';
import { useChannel } from '../../lib/realtime.ts';

export type Notification = Outputs['notifications']['list']['items'][number];

export const inboxQuery = () => orpc.notifications.list.queryOptions({ input: {} });

const VERB: Record<Notification['kind'], string> = {
  assigned: 'assigned you',
  mentioned: 'mentioned you in',
  commented: 'commented on',
};

/** "Ada assigned you RF-12", "Linus mentioned you in RF-3". */
export const summarize = (n: Notification) =>
  `${n.actorName ?? 'Someone'} ${VERB[n.kind]} ${n.data.identifier ?? 'a task'}`;

/** `RF-12` → the task's project key and the URL that opens it. */
export function linkFor(n: Notification): { key: string; task: string } | null {
  const identifier = n.data.identifier;
  const key = identifier?.split('-')[0];
  return identifier && key ? { key, task: identifier } : null;
}

/** The inbox and its unread count. Safe to call from any number of components. */
export const useInbox = () => useQuery(inboxQuery());

/**
 * Keep the inbox live for this tab: new notifications arrive on the personal channel, refresh the inbox and
 * announce themselves with a toast. Call once per tab (the app shell), or every caller would toast.
 */
export function useLiveInbox() {
  const queryClient = useQueryClient();

  useChannel('me', async (event) => {
    if (event.topic !== 'notifications.created') return;
    await queryClient.invalidateQueries({ queryKey: orpc.notifications.key() });
    const latest = queryClient.getQueryData(inboxQuery().queryKey)?.items[0];
    if (latest && !latest.readAt) {
      toast({ title: summarize(latest), description: latest.data.excerpt ?? latest.data.title });
    }
  });
}
