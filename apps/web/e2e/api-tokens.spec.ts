import { expect, test } from '@playwright/test';

test('create a read-only token, call the API with it, and revoke it', async ({
  page,
  playwright,
  baseURL,
}) => {
  await page.goto('/settings/account');
  const section = page.getByRole('region', { name: 'API tokens' });
  await section.getByRole('button', { name: 'Create token' }).click();
  const create = page.getByRole('dialog', { name: 'Create API token' });
  await create.getByLabel('Name').fill('Wallboard');
  await create.getByRole('button', { name: 'Create token' }).click();

  const shown = page.getByRole('dialog', { name: 'Your new token' });
  const secret = await shown.getByLabel('Token', { exact: true }).inputValue();
  expect(secret).toMatch(/^tf_/);
  await shown.getByRole('button', { name: 'Done' }).click();
  await expect(section.getByText('Wallboard')).toBeVisible();
  await expect(section.getByText('Read only')).toBeVisible();

  // No cookies: the token alone authenticates.
  const api = await playwright.request.newContext({
    baseURL,
    extraHTTPHeaders: { authorization: `Bearer ${secret}` },
  });
  const projects = await api.get('/api/v1/projects');
  expect(projects.status()).toBe(200);
  expect(JSON.stringify(await projects.json())).toContain('Rover Firmware');
  expect((await api.post('/api/v1/tasks', { data: { title: 'nope' } })).status()).toBe(403);

  await page.reload();
  await expect(section.getByText(/last used/)).toBeVisible();
  await section.getByRole('button', { name: 'Revoke Wallboard' }).click();
  await expect(section.getByText('Wallboard')).toBeHidden();
  expect((await api.get('/api/v1/projects')).status()).toBe(401);
  await api.dispose();
});
