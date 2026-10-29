import { createAuth } from '@teamflow/auth';
import { createDatabase } from '@teamflow/db';
import { systemClock } from '@teamflow/domain';
import { EMAIL_QUEUE } from '@teamflow/email';
import type { Server, ServerWebSocket } from 'bun';
import { PgBoss } from 'pg-boss';
import { createApp } from './app.ts';
import { type CollabData, createCollab } from './collab/server.ts';
import { readEnv } from './env.ts';
import { createLogger } from './logger.ts';
import { createGateway, type SocketData } from './realtime/gateway.ts';
import { listen, presenceNotifier } from './realtime/listen.ts';
import { createS3Storage } from './storage.ts';

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
  rateLimit: env.AUTH_RATE_LIMIT === 'on',
  github:
    env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET
      ? { clientId: env.GITHUB_CLIENT_ID, clientSecret: env.GITHUB_CLIENT_SECRET }
      : undefined,
  sendEmail: async (email) => {
    await boss.send(EMAIL_QUEUE, email, { retryLimit: 5, retryDelay: 10, retryBackoff: true });
    if (env.NODE_ENV !== 'production') logger.debug({ email }, 'email queued');
  },
});

const storage = await createS3Storage({
  endpoint: env.S3_ENDPOINT,
  region: env.S3_REGION,
  bucket: env.S3_BUCKET,
  accessKeyId: env.S3_ACCESS_KEY_ID,
  secretAccessKey: env.S3_SECRET_ACCESS_KEY,
});

const app = createApp(
  {
    db: database.db,
    auth,
    clock: systemClock,
    logger,
    storage,
    // Defined below; only called once requests arrive.
    onDescriptionReplaced: (organizationId, taskId, text) =>
      collab.replaceDescription(organizationId, taskId, text),
  },
  {
    apiUrl: env.API_URL,
    webUrl: env.WEB_URL,
    // Defined below; only called once requests arrive.
    onAccessChanged: () => void revalidateSockets(),
  },
);

const gateway = createGateway({
  db: database.db,
  auth,
  logger,
  notifyPresence: presenceNotifier(database.sql),
});

const collab = createCollab({ db: database.db, auth, clock: systemClock, logger });

// One Bun server, two kinds of socket: realtime events (`/ws`) and collaborative documents (`/collab/:taskId`).
type AnySocket = ServerWebSocket<SocketData | CollabData>;
const isCollab = (ws: AnySocket): ws is ServerWebSocket<CollabData> =>
  'kind' in ws.data && ws.data.kind === 'collab';
const asRealtime = (ws: AnySocket) => ws as ServerWebSocket<SocketData>;

const server = Bun.serve<SocketData | CollabData>({
  port: env.PORT,
  fetch(request, bunServer) {
    const { pathname } = new URL(request.url);
    if (pathname === '/ws') return gateway.upgrade(request, bunServer as Server<SocketData>);
    if (collab.matches(pathname)) return collab.upgrade(request, bunServer as Server<CollabData>);
    return app.fetch(request, bunServer);
  },
  websocket: {
    idleTimeout: 60,
    open: (ws) =>
      isCollab(ws) ? collab.websocket.open(ws) : gateway.websocket.open(asRealtime(ws)),
    message: (ws, message) =>
      isCollab(ws)
        ? collab.websocket.message(ws, message)
        : gateway.websocket.message(asRealtime(ws), message),
    close: (ws) =>
      isCollab(ws) ? collab.websocket.close(ws) : gateway.websocket.close(asRealtime(ws)),
  },
});
gateway.bind(server as Server<SocketData>);
await listen(database.sql, gateway, logger);
const heartbeat = setInterval(() => gateway.heartbeat(), 15_000);
// Membership and sessions can also change on another api node, or expire: re-check open sockets regularly.
async function revalidateSockets() {
  await gateway.revalidate();
  await collab.revalidate();
}
const revalidation = setInterval(() => void revalidateSockets(), 30_000);
logger.info({ url: server.url.href }, 'api listening');

const shutdown = async (signal: string) => {
  logger.info({ signal }, 'shutting down');
  clearInterval(heartbeat);
  clearInterval(revalidation);
  // Close every connection first (`stop()` alone waits for open sockets, which clients keep alive forever), so no
  // edit can arrive after the final save; then save what the editors left behind.
  await server.stop(true);
  await collab.flush();
  await boss.stop({ graceful: false });
  await database.close();
  process.exit(0);
};
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
