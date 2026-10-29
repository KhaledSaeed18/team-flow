import { expect, test } from '@playwright/test';

test('find a task by something said in its comments', async ({ page }) => {
  await page.goto('/p/RF?task=RF-8');
  const comments = page
    .getByRole('complementary', { name: /RF-8/ })
    .getByRole('region', { name: 'Comments' });
  await comments.getByLabel('Write a comment').fill('The quasar firmware build fixes the stall.');
  await comments.getByRole('button', { name: 'Comment', exact: true }).click();
  await expect(comments.getByText('The quasar firmware build fixes the stall.')).toBeVisible();

  await page.getByRole('button', { name: 'Close task' }).click();
  await page.keyboard.press('/');
  await page.getByRole('searchbox', { name: 'Search tasks, projects and actions' }).fill('quasar');
  const hit = page.getByRole('menuitem').filter({ hasText: 'In a comment: “The quasar firmware' });
  await expect(hit).toBeVisible();
  await expect(hit).toContainText('RF-8');
  await hit.click();
  await expect(page).toHaveURL(/task=RF-8/);
});
