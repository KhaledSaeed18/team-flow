import { expect, test } from '@playwright/test';
import { column } from './support.ts';

test.describe('project settings', () => {
  test('editing the workflow changes the board', async ({ page }) => {
    await page.goto('/p/FC/settings');
    await expect(page.getByRole('heading', { name: 'Project settings' })).toBeVisible();

    // Rename a status.
    const review = page.getByRole('textbox', { name: 'Name of In Review' });
    await review.fill('Code review');
    await review.press('Enter');
    await expect(page.getByRole('textbox', { name: 'Name of Code review' })).toBeVisible();

    // Add one.
    await page.getByLabel('New status').fill('QA');
    await page.getByRole('button', { name: 'Add status' }).click();
    await expect(page.getByRole('textbox', { name: 'Name of QA' })).toBeVisible();

    await page.getByRole('link', { name: 'Board', exact: true }).click();
    await expect(column(page, 'Code review')).toBeVisible();
    await expect(column(page, 'QA')).toBeVisible();
  });

  test('a rename the server refuses puts the saved name back', async ({ page }) => {
    await page.goto('/p/FC/settings');
    const todo = page.getByRole('textbox', { name: 'Name of Todo' });
    // Another status already has this name.
    await todo.fill('Done');
    await todo.press('Enter');
    await expect(page.getByText('Status not changed')).toBeVisible();
    await expect(todo).toHaveValue('Todo');
  });

  test('the last done-type status cannot be deleted', async ({ page }) => {
    await page.goto('/p/FC/settings');
    await page.getByRole('button', { name: 'Delete Done' }).click();
    await expect(page.getByRole('dialog')).toContainText('only done status');
  });

  test('a new label is offered on tasks', async ({ page }) => {
    await page.goto('/p/RF/settings');
    await page.getByLabel('New label').fill('Field test');
    await page.getByRole('button', { name: 'Add label' }).click();
    await expect(page.getByRole('textbox', { name: 'Name of Field test' })).toBeVisible();

    await page.goto('/p/RF?task=RF-17');
    await page
      .getByRole('complementary', { name: /RF-17/ })
      .getByRole('button', { name: /Navigation|Add labels/ })
      .click();
    await expect(page.getByRole('option', { name: 'Field test' })).toBeVisible();
  });
});

test('removing a member asks first, and Cancel keeps them', async ({ page }) => {
  await page.goto('/settings/members');
  await page.getByRole('button', { name: 'Remove Omar Haddad' }).click();
  const dialog = page.getByRole('dialog', { name: 'Remove Omar Haddad?' });
  await expect(dialog).toContainText('lose access to every project');
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('button', { name: 'Remove Omar Haddad' })).toBeVisible();
});
