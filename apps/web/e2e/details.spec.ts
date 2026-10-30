import { expect, test } from '@playwright/test';

/** Small things a careful user noticed; each one was broken once. */

test('a completed sprint keeps a way to its report', async ({ page }) => {
  await page.goto('/p/RF/backlog');
  const completed = page.getByRole('region', { name: 'Completed sprints' });
  await expect(completed).toBeVisible();
  await completed
    .getByRole('link', { name: /^Report for / })
    .first()
    .click();
  await expect(page).toHaveURL(/\/sprints\//);
  await expect(page.getByRole('img', { name: /Burndown/ })).toBeVisible();
});

test('the shortcuts list says which ones need a project', async ({ page }) => {
  await page.goto('/inbox');
  await page.keyboard.press('?');
  const dialog = page.getByRole('dialog', { name: 'Keyboard shortcuts' });
  await expect(dialog.getByRole('heading', { name: 'In a project' })).toBeVisible();
});

test('signed-out pages log no errors', async ({ browser }) => {
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  for (const path of ['/sign-in', '/sign-up', '/forgot-password']) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  }
  expect(errors).toEqual([]);
  await context.close();
});

test('after an empty-name error, the next Save still saves', async ({ page }) => {
  await page.goto('/settings/account');
  const name = page.getByRole('textbox', { name: 'Name' });
  const save = page.getByRole('region', { name: 'Profile' }).getByRole('button', { name: 'Save' });
  const before = await save.boundingBox();
  await name.fill('');
  await save.click();
  await name.fill('Demo User');
  // The error under the field must not move the button out from under the pointer.
  expect((await save.boundingBox())?.y).toBe(before?.y);
  await save.click();
  await expect(page.getByText('Profile saved')).toBeVisible();
});
