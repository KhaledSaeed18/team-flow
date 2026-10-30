import { createDatabase, OUTBOX_WAKE_CHANNEL, pruneOutbox, relayOutbox } from '@teamflow/db';
import { EMAIL_QUEUE } from '@teamflow/email';
import { PG_EVENTS_CHANNEL } from '@teamflow/realtime';
import { createTransport } from 'nodemailer';
import { PgBoss } from 'pg-boss';
import pino from 'pino';
import { z } from 'zod';
import { DIGEST_QUEUE, runDigests } from './digest.ts';
import { deliverEmails } from './email.ts';
import { REBALANCE_QUEUE, runRebalance } from './rebalance.ts';
import { createRelayLoop } from './relay.ts';

const env = z
  .object({
    DATABASE_URL: z.url(),
    LOG_LEVEL: z.string().default('info'),
    RELAY_POLL_MS: z.coerce.number().int().positive().default(5_000),
    WEB_URL: z.url().default('http://localhost:5173'),
    SMTP_URL: z.string().default('smtp://localhost:1035'),
    MAIL_FROM: z.string().default('TeamFlow <no-reply@teamflow.local>'),
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

// Jobs: pg-boss in the same database (ADR-0006).
const boss = new PgBoss({
  connectionString: env.DATABASE_URL,
  application_name: 'teamflow-worker',
});
boss.on('error', (error) => logger.error({ err: error }, 'job queue error'));
await boss.start();
await boss.createQueue(EMAIL_QUEUE);
const mailer = createTransport(env.SMTP_URL);
// One email per job run: a delivery failure retries that email only, never the ones already sent beside it.
await boss.work(EMAIL_QUEUE, { batchSize: 1 }, (jobs) =>
  deliverEmails(jobs, {
    mailer,
    from: env.MAIL_FROM,
    webUrl: env.WEB_URL,
    onDropped: (id) => logger.warn({ jobId: id }, 'dropped malformed email job'),
  }),
);

// Digests: an hourly pass; pg-boss runs each scheduled job once across every worker.
await boss.createQueue(DIGEST_QUEUE);
await boss.schedule(DIGEST_QUEUE, '0 * * * *');
await boss.work(DIGEST_QUEUE, async () => {
  const sent = await runDigests({
    db: database.db,
    now: new Date(),
    enqueue: (message) =>
      boss.send(EMAIL_QUEUE, message, { retryLimit: 5, retryDelay: 60, retryBackoff: true }),
  });
  if (sent > 0) logger.info({ sent }, 'digests enqueued');
});
// Rank rebalancing: a nightly pass over columns whose keys grew too long (ADR-0008).
await boss.createQueue(REBALANCE_QUEUE);
await boss.schedule(REBALANCE_QUEUE, '30 3 * * *');
await boss.work(REBALANCE_QUEUE, async () => {
  const moved = await runRebalance(database.db, (statusId, error) =>
    logger.error({ err: error, statusId }, 'rank rebalance failed for a column'),
  );
  if (moved > 0) logger.info({ moved }, 'ranks rebalanced');
});
logger.info('worker started');

const shutdown = async (signal: string) => {
  logger.info({ signal }, 'shutting down');
  clearInterval(poll);
  clearInterval(prune);
  await boss.stop({ graceful: true });
  await relay.run();
  await database.close();
  process.exit(0);
};
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
