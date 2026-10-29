import { expect, test } from '@playwright/test';
import { card } from './support.ts';

test('sub-tasks show progress on the card and links read from both sides', async ({ page }) => {
  await page.goto('/p/RF?task=RF-22');
  const panel = page.getByRole('complementary', { name: /RF-22/ });

  const subtask = panel.getByLabel('New sub-task');
  await subtask.fill('Tune replan hysteresis');
  await subtask.press('Enter');
  await subtask.fill('Add a replan counter to telemetry');
  await subtask.press('Enter');
  await expect(panel.getByRole('progressbar', { name: 'Sub-tasks done' })).toHaveAttribute(
    'aria-valuemax',
    '2',
  );
  await expect(card(page, 'RF-22').getByText('0/2')).toBeVisible();

  await panel.getByRole('button', { name: 'Link a task' }).click();
  await panel.getByRole('button', { name: /Link type/ }).click();
  await page.getByRole('option', { name: 'Blocked by' }).click();
  await panel.getByRole('combobox', { name: 'Task to link' }).fill('lidar');
  await page.getByRole('option', { name: /Lidar driver timeouts/ }).click();
  await expect(panel.locator('p', { hasText: /^Blocked by$/ })).toBeVisible();
  await expect(panel.getByRole('button', { name: /RF-5 Lidar driver timeouts/ })).toBeVisible();

  // From the other task, the same link reads "Blocks".
  await panel.getByRole('button', { name: /RF-5 Lidar driver timeouts/ }).click();
  const other = page.getByRole('complementary', { name: /RF-5/ });
  await expect(other.locator('p', { hasText: /^Blocks$/ })).toBeVisible();
  await expect(
    other.getByRole('button', { name: /RF-22 Path planner replans too often/ }),
  ).toBeVisible();
});
