import { createAuth } from '@teamflow/auth';
import { createDatabase } from '@teamflow/db';
import { systemClock } from '@teamflow/domain';
import { EMAIL_QUEUE } from '@teamflow/email';
import { PgBoss } from 'pg-boss';
import { createApp } from './app.ts';
import { readEnv } from './env.ts';
import { createLogger } from './logger.ts';
import { createGateway, type SocketData } from './realtime/gateway.ts';
import { listen, presenceNotifier } from './realtime/listen.ts';

const env = readEnv();
const logger = createLogger(env.LOG_LEVEL);
const database = createDatabase({
  url: env.DATABASE_URL,
  max: env.DATABASE_POOL_MAX,
  applicationName: 'teamflow-api',
});

// The api only enqueues; the worker owns schedules, maintenance and delivery.
const boss = new PgBoss({
  connectionString: env.DATABASE_URL,
  application_name: 'teamflow-api',
  supervise: false,
  schedule: false,
});
boss.on('error', (error) => logger.error({ err: error }, 'job queue error'));
await boss.start();
await boss.createQueue(EMAIL_QUEUE);

const auth = createAuth({
  db: database.db,
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.API_URL,
  trustedOrigins: [env.WEB_URL],
  github:
    env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET
      ? { clientId: env.GITHUB_CLIENT_ID, clientSecret: env.GITHUB_CLIENT_SECRET }
      : undefined,
  sendEmail: async (email) => {
    await boss.send(EMAIL_QUEUE, email, { retryLimit: 5, retryDelay: 10, retryBackoff: true });
    if (env.NODE_ENV !== 'production') logger.debug({ email }, 'email queued');
  },
});

const app = createApp(
  { db: database.db, auth, clock: systemClock, logger },
  { apiUrl: env.API_URL, webUrl: env.WEB_URL },
);

const gateway = createGateway({
  db: database.db,
  auth,
  logger,
  notifyPresence: presenceNotifier(database.sql),
});

const server = Bun.serve<SocketData>({
  port: env.PORT,
  fetch(request, bunServer) {
    if (new URL(request.url).pathname === '/ws') return gateway.upgrade(request, bunServer);
    return app.fetch(request, bunServer);
  },
  websocket: gateway.websocket,
});
gateway.bind(server);
await listen(database.sql, gateway, logger);
const heartbeat = setInterval(() => gateway.heartbeat(), 15_000);
logger.info({ url: server.url.href }, 'api listening');

const shutdown = async (signal: string) => {
  logger.info({ signal }, 'shutting down');
  clearInterval(heartbeat);
  await server.stop();
  await boss.stop({ graceful: false });
  await database.close();
  process.exit(0);
};
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
