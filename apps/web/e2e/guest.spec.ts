import { expect, test } from '@playwright/test';
import { NEW_PASSWORD, signInAsSofia, sofia } from './support.ts';

// A fresh sign-in as the guest; the default saved session is the demo owner.
test.use({ storageState: { cookies: [], origins: [] } });

test('a guest can read everything and comment, but is offered nothing they cannot do', async ({
  browser,
}) => {
  const { page, close } = await signInAsSofia(browser, sofia.password, NEW_PASSWORD);
  await expect(
    page
      .getByRole('navigation', { name: 'Workspace' })
      .getByRole('button', { name: 'New project' }),
  ).toHaveCount(0);

  await page.goto('/p/RF?task=RF-13');
  const panel = page.getByRole('complementary', { name: /RF-13/ });
  await expect(panel.getByRole('textbox', { name: 'Title' })).toHaveAttribute('readonly', '');
  await expect(panel.getByRole('button', { name: /Status/ })).toBeDisabled();
  await expect(panel.getByRole('button', { name: /^Labels/ })).toBeDisabled();
  await expect(panel.getByLabel('Due date')).toBeDisabled();
  // Guests may comment.
  await expect(panel.getByRole('combobox', { name: 'Write a comment' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add task' })).toHaveCount(0);

  await page.goto('/p/RF/backlog');
  await expect(page.getByRole('heading', { name: 'Planning' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'New sprint' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Complete sprint' })).toHaveCount(0);
  await close();
});
