import { createAuth } from '@teamflow/auth';
import { createDatabase } from '@teamflow/db';
import { systemClock } from '@teamflow/domain';
import { createApp } from './app.ts';
import { readEnv } from './env.ts';
import { createLogger } from './logger.ts';

const env = readEnv();
const logger = createLogger(env.LOG_LEVEL);
const database = createDatabase({
  url: env.DATABASE_URL,
  max: env.DATABASE_POOL_MAX,
  applicationName: 'teamflow-api',
});

const auth = createAuth({
  db: database.db,
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.API_URL,
  trustedOrigins: [env.WEB_URL],
  github:
    env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET
      ? { clientId: env.GITHUB_CLIENT_ID, clientSecret: env.GITHUB_CLIENT_SECRET }
      : undefined,
  // Until the worker owns delivery, development prints codes to the log.
  sendEmail: async (email) => {
    logger.info(
      { email: env.NODE_ENV === 'production' ? { kind: email.kind } : email },
      'auth email',
    );
  },
});

const app = createApp(
  { db: database.db, auth, clock: systemClock, logger },
  { apiUrl: env.API_URL, webUrl: env.WEB_URL },
);

const server = Bun.serve({ port: env.PORT, fetch: app.fetch });
logger.info({ url: server.url.href }, 'api listening');

const shutdown = async (signal: string) => {
  logger.info({ signal }, 'shutting down');
  await server.stop();
  await database.close();
  process.exit(0);
};
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
