import { expect, test } from '@playwright/test';
import { column } from './support.ts';

test('a view that fails to load keeps the app around it, and Try again recovers', async ({
  page,
}) => {
  await page.route('**/rpc/tasks/list', (route) =>
    route.fulfill({ status: 502, body: 'Bad Gateway' }),
  );
  await page.goto('/p/RF/list');
  await expect(page.getByRole('heading', { name: 'This page could not be loaded' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Workspace' })).toBeVisible();

  await page.unroute('**/rpc/tasks/list');
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByRole('grid')).toBeVisible();
});

test('a link to an unknown sprint shows the active sprint, not an empty board', async ({
  page,
}) => {
  await page.goto('/p/RF?sprint=not-a-sprint');
  await expect(column(page, 'Todo')).toContainText('RF-32');
  await expect(page.getByRole('button', { name: /Show tasks from/ })).toContainText('Sprint 4');
});

test('a malformed sprint report link is a missing page, without asking the API', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto('/p/RF/sprints/abc');
  await expect(page.getByRole('heading', { name: 'This page does not exist' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('an inbox that fails to load says so, instead of looking empty', async ({ page }) => {
  await page.route('**/rpc/notifications/list', (route) => route.fulfill({ status: 500 }));
  await page.goto('/inbox');
  await expect(page.getByRole('alert')).toContainText('The inbox could not be loaded');
  await expect(page.getByText('Nothing here yet')).toBeHidden();
});

test('a search that fails says so, instead of "nothing matches"', async ({ page }) => {
  await page.route('**/rpc/search/tasks', (route) => route.fulfill({ status: 500 }));
  await page.goto('/p/RF');
  await page.getByRole('grid').first().waitFor();
  await page.keyboard.press('/');
  await page.getByRole('searchbox', { name: 'Search tasks, projects and actions' }).fill('zzz');
  await expect(page.getByText('Search is not available right now')).toBeVisible({
    timeout: 15_000,
  });
});

test('saved views that fail to load say so', async ({ page }) => {
  await page.route('**/rpc/views/list', (route) => route.fulfill({ status: 500 }));
  await page.goto('/p/RF/list');
  await expect(page.getByText('Saved views could not be loaded')).toBeVisible({ timeout: 15_000 });
});

test('an expired invitation is not listed as pending', async ({ page }) => {
  const day = 86_400_000;
  await page.route('**/api/auth/organization/list-invitations*', (route) =>
    route.fulfill({
      json: [
        {
          id: '01900000-0000-7000-8000-000000000001',
          email: 'expired@example.com',
          role: 'member',
          status: 'pending',
          expiresAt: new Date(Date.now() - day).toISOString(),
        },
        {
          id: '01900000-0000-7000-8000-000000000002',
          email: 'waiting@example.com',
          role: 'member',
          status: 'pending',
          expiresAt: new Date(Date.now() + day).toISOString(),
        },
      ],
    }),
  );
  await page.goto('/settings/members');
  await expect(page.getByText('waiting@example.com')).toBeVisible();
  await expect(page.getByText('expired@example.com')).toBeHidden();
});
