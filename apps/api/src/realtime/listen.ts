import { PG_EVENTS_CHANNEL, PG_PRESENCE_CHANNEL, RelayedEvent } from '@teamflow/realtime';
import type postgres from 'postgres';
import type { Logger } from '../logger.ts';
import type { Gateway, PresenceUpdate } from './gateway.ts';

/** Share presence with other api nodes. */
export const presenceNotifier = (sql: postgres.Sql) => (update: PresenceUpdate) => {
  void sql.notify(PG_PRESENCE_CHANNEL, JSON.stringify(update)).catch(() => {});
};

/**
 * Subscribe this node to relayed domain events and to other nodes' presence. postgres.js re-issues LISTEN after
 * a reconnect, so a database restart does not silently stop realtime.
 */
export async function listen(sql: postgres.Sql, gateway: Gateway, logger: Logger) {
  await sql.listen(PG_EVENTS_CHANNEL, (payload) => {
    try {
      const event = RelayedEvent.safeParse(JSON.parse(payload));
      if (event.success) gateway.publish(event.data);
      else logger.warn({ payload }, 'malformed relayed event');
    } catch (error) {
      logger.warn({ err: error }, 'unreadable relayed event');
    }
  });
  await sql.listen(PG_PRESENCE_CHANNEL, (payload) => {
    try {
      gateway.receivePresence(JSON.parse(payload) as PresenceUpdate);
    } catch {
      // A malformed presence update is not worth more than dropping it.
    }
  });
}
