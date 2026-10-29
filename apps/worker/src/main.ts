import { createDatabase, OUTBOX_WAKE_CHANNEL, pruneOutbox, relayOutbox } from '@teamflow/db';
import { PG_EVENTS_CHANNEL } from '@teamflow/realtime';
import pino from 'pino';
import { z } from 'zod';
import { createRelayLoop } from './relay.ts';

const env = z
  .object({
    DATABASE_URL: z.url(),
    LOG_LEVEL: z.string().default('info'),
    RELAY_POLL_MS: z.coerce.number().int().positive().default(5_000),
  })
  .parse(process.env);

const logger = pino({ level: env.LOG_LEVEL, base: { service: 'worker' } });
const database = createDatabase({
  url: env.DATABASE_URL,
  max: 4,
  applicationName: 'teamflow-worker',
});

const relay = createRelayLoop(
  async () => {
    const published = await relayOutbox(database.db, { channel: PG_EVENTS_CHANNEL });
    if (published > 0) logger.debug({ published }, 'outbox relayed');
    return published;
  },
  (error) => logger.error({ err: error }, 'outbox relay failed'),
);

// Woken by the outbox insert trigger; the poll is only a safety net for missed notifications.
await database.sql.listen(
  OUTBOX_WAKE_CHANNEL,
  () => relay.wake(),
  () => relay.wake(),
);
const poll = setInterval(() => relay.wake(), env.RELAY_POLL_MS);
const prune = setInterval(
  () =>
    void pruneOutbox(database.db).catch((error) =>
      logger.error({ err: error }, 'outbox prune failed'),
    ),
  60 * 60 * 1000,
);
relay.wake();
logger.info('worker started');

const shutdown = async (signal: string) => {
  logger.info({ signal }, 'shutting down');
  clearInterval(poll);
  clearInterval(prune);
  await relay.run();
  await database.close();
  process.exit(0);
};
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
