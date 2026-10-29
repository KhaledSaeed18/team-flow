import { expect, test } from '@playwright/test';

test('a broken link drops the bad parts instead of breaking the page', async ({ page }) => {
  await page.goto(`/p/RF/list?assignee=me&q=${'x'.repeat(250)}&sort=nonsense`);
  await expect(page.getByRole('grid')).toBeVisible();
  await expect(page.getByLabel('Filter tasks')).toHaveValue('');

  await page.goto('/p/RF/calendar?month=2026-13');
  await expect(page.getByRole('region', { name: 'Unscheduled' })).toBeVisible();
});

test('an archived project can be found and restored', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'New project' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Name').fill('Shelved Work');
  await dialog.getByLabel('Key').fill('SHLV');
  await dialog.getByRole('button', { name: 'Create project' }).click();
  await expect(page).toHaveURL(/\/p\/SHLV/);

  await page.goto('/p/SHLV/settings');
  await page.getByRole('button', { name: 'Archive project' }).click();
  const nav = page.getByRole('navigation', { name: 'Workspace' });
  await expect(nav.getByRole('link', { name: /Shelved Work/ })).toHaveCount(0);

  await nav.getByText(/^Archived/).click();
  await nav.getByRole('link', { name: /Shelved Work/ }).click();
  await expect(page.getByText(/This project is archived/)).toBeVisible();
  await page.getByRole('button', { name: 'Restore project' }).click();
  await expect(page.getByText(/This project is archived/)).toBeHidden();
  await expect(
    nav.getByRole('link', { name: /Shelved Work/ }).filter({ hasNot: page.locator('details *') }),
  ).toBeVisible();
});
