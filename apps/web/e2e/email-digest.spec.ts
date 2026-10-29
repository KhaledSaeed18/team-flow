import { expect, test } from '@playwright/test';

test('choose how often summary emails arrive', async ({ page }) => {
  await page.goto('/settings/account');
  const email = page.getByRole('region', { name: 'Email' });
  const select = email.getByRole('button', { name: /Summary emails/ });
  await expect(select).toContainText('Daily');

  await select.click();
  await page.getByRole('option', { name: 'Weekly' }).click();
  await expect(page.getByText('Email preference saved')).toBeVisible();
  await page.reload();
  await expect(email.getByRole('button', { name: /Summary emails/ })).toContainText('Weekly');
});
