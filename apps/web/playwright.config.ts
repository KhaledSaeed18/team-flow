import { defineConfig, devices } from '@playwright/test';
import { E2E } from './e2e/env.ts';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${E2E.webPort}`,
    trace: 'retain-on-failure',
    viewport: { width: 1440, height: 900 },
  },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      name: 'chromium',
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
        storageState: 'e2e/.auth/demo.json',
      },
    },
  ],
  webServer: [
    {
      // Fresh database, seed, api and worker (see e2e/stack.ts).
      command: 'bun e2e/stack.ts',
      url: `http://localhost:${E2E.apiPort}/ready`,
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: `bunx vite --port ${E2E.webPort} --strictPort`,
      url: `http://localhost:${E2E.webPort}`,
      env: { API_PROXY_TARGET: `http://localhost:${E2E.apiPort}` },
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});
