import { expect, test } from '@playwright/test';

test('filter the list, save it as a shared view, edit and reset it', async ({ page }) => {
  await page.goto('/p/RF/list');
  const table = page.getByRole('grid');
  const rows = table.getByRole('row');
  await expect(rows.nth(1)).toBeVisible();
  const everything = await rows.count();

  // Facets: urgent or high priority.
  await page.getByRole('button', { name: 'Priority' }).click();
  await page.getByRole('option', { name: 'Urgent' }).click();
  await page.getByRole('option', { name: 'High' }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: /Priority: Urgent, High/ })).toBeVisible();
  await expect(page).toHaveURL(/priority=/);
  await expect.poll(() => rows.count()).toBeLessThan(everything);
  const narrowed = await rows.count();

  await page.getByRole('button', { name: 'Save as view…' }).click();
  const dialog = page.getByRole('dialog', { name: 'Save view' });
  await dialog.getByLabel('Name').fill('Hot list');
  await dialog.getByText('Share with everyone in the workspace').click();
  await dialog.getByRole('button', { name: 'Save view' }).click();
  await expect(page.getByRole('button', { name: 'View: Hot list' })).toBeVisible();
  await expect(page).toHaveURL(/view=/);

  // Changing the filters marks the view edited; Reset brings it back.
  await page.getByRole('button', { name: /Priority: Urgent, High/ }).click();
  await page.getByRole('option', { name: 'High' }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'View: Hot list' })).toContainText('edited');
  await page.getByRole('button', { name: 'Reset' }).click();
  await expect(page.getByRole('button', { name: /Priority: Urgent, High/ })).toBeVisible();
  await expect.poll(() => rows.count()).toBe(narrowed);

  // Back to everything, then pick the view from the menu.
  await page.getByRole('button', { name: 'View: Hot list' }).click();
  await page.getByRole('menuitem', { name: 'All tasks' }).click();
  await expect.poll(() => rows.count()).toBe(everything);
  await page.getByRole('button', { name: 'View: All tasks' }).click();
  await page.getByRole('menuitem', { name: /Hot list/ }).click();
  await expect.poll(() => rows.count()).toBe(narrowed);

  await page.getByRole('button', { name: 'View options' }).click();
  await page.getByRole('menuitem', { name: 'Delete view' }).click();
  await expect(page.getByRole('button', { name: 'View: All tasks' })).toBeVisible();
});
