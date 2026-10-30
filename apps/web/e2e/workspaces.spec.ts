import { expect, test } from '@playwright/test';

/** Runs last on purpose (file order): it switches the demo user's workspace and switches it back. */
test('a link to a project in another of your workspaces opens it there', async ({ page }) => {
  await page.goto('/inbox');
  const call = (path: string, body: unknown) =>
    page.evaluate(
      async ([p, b]) =>
        (
          await fetch(p as string, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(b),
          })
        ).json(),
      [path, body] as const,
    );
  const me = await call('/rpc/me/get', { json: {} });
  const home = me.json.activeOrganizationId as string;
  const slug = `second-${Date.now()}`;
  const second = await call('/api/auth/organization/create', { name: 'Second shop', slug });
  await call('/rpc/projects/create', { json: { key: 'SEC', name: 'Second project' } });
  await call('/api/auth/organization/set-active', { organizationId: home });

  try {
    await page.goto('/p/SEC');
    await expect(page.getByRole('heading', { name: 'Second project', level: 1 })).toBeVisible();
    await expect(page).toHaveURL(/\/p\/SEC$/);
    await expect(page.getByRole('navigation', { name: 'Workspace' })).toContainText('Second shop');
  } finally {
    await call('/api/auth/organization/set-active', { organizationId: home });
  }
  expect(second.id).toBeTruthy();
});

test('a project key that is in none of your workspaces is a missing page', async ({ page }) => {
  await page.goto('/p/NOPE');
  await expect(page.getByRole('heading', { name: 'This page does not exist' })).toBeVisible();
});
