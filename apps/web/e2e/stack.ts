/**
 * The server side of the end-to-end stack: a fresh database (dropped, migrated, seeded with the demo workspace),
 * then the api and the worker. Playwright starts this as a web server and waits for the api to be ready.
 */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';
import { E2E } from './env.ts';

const root = fileURLToPath(new URL('../../..', import.meta.url));
const env = {
  ...process.env,
  DATABASE_URL: E2E.databaseUrl,
  BETTER_AUTH_SECRET: 'e2e-secret-that-is-long-enough-for-better-auth',
  API_URL: `http://localhost:${E2E.webPort}`,
  WEB_URL: `http://localhost:${E2E.webPort}`,
  PORT: String(E2E.apiPort),
  LOG_LEVEL: 'warn',
  RELAY_POLL_MS: '500',
};

const url = new URL(E2E.databaseUrl);
const name = url.pathname.slice(1);
const admin = postgres(Object.assign(new URL(url), { pathname: '/postgres' }).toString(), {
  max: 1,
  onnotice: () => {},
});
await admin.unsafe(`drop database if exists "${name}" with (force)`);
await admin.unsafe(`create database "${name}"`);
await admin.end();

const run = (args: string[]) =>
  new Promise<void>((resolve, reject) => {
    const child = spawn('bun', args, { cwd: root, env, stdio: 'inherit' });
    child.on('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(`${args.join(' ')} exited with ${code}`)),
    );
  });
await run(['packages/db/src/migrate.ts']);
await run(['apps/api/scripts/seed.ts']);

const children = [
  spawn('bun', ['apps/api/src/server.ts'], { cwd: root, env, stdio: 'inherit' }),
  spawn('bun', ['apps/worker/src/main.ts'], { cwd: root, env, stdio: 'inherit' }),
];
const stop = () => {
  for (const child of children) child.kill('SIGTERM');
  process.exit(0);
};
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
for (const child of children) child.on('exit', (code) => code && code !== 0 && process.exit(code));
