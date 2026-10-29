import { defineConfig } from 'drizzle-kit';
import { loadRootEnv } from './src/env.ts';

loadRootEnv();

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema/index.ts',
  out: './drizzle',
  casing: 'snake_case',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://teamflow:teamflow@localhost:5442/teamflow',
  },
  strict: true,
  verbose: true,
});
