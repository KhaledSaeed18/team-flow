import { expect, test } from '@playwright/test';

test('admins read who changed what in the workspace', async ({ page }) => {
  // Make something worth auditing: a token.
  await page.goto('/settings/account');
  const tokens = page.getByRole('region', { name: 'API tokens' });
  await tokens.getByRole('button', { name: 'Create token' }).click();
  const create = page.getByRole('dialog', { name: 'Create API token' });
  await create.getByLabel('Name').fill('Audit probe');
  await create.getByRole('button', { name: 'Create token' }).click();
  await page
    .getByRole('dialog', { name: 'Your new token' })
    .getByRole('button', { name: 'Done' })
    .click();

  await page
    .getByRole('navigation', { name: 'Workspace' })
    .getByRole('link', { name: 'Audit log' })
    .click();
  await expect(page.getByRole('heading', { name: 'Audit log' })).toBeVisible();
  const first = page.getByRole('listitem').first();
  await expect(first).toContainText('Demo User');
  await expect(first).toContainText('created the read-only API token “Audit probe”');
});
