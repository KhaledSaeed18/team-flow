import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';

/** Load the repository root `.env` for CLI entry points run from inside the package. */
export function loadRootEnv(): void {
  const path = new URL('../../../.env', import.meta.url).pathname;
  if (existsSync(path)) loadEnvFile(path);
}
