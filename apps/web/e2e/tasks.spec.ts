import { expect, test } from '@playwright/test';
import { card, column, openBoard } from './support.ts';

test.describe('working on tasks', () => {
  test.beforeEach(async ({ page }) => {
    await openBoard(page);
  });

  test('the board shows the active sprint and a task opens beside it', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Sprint 4.*Show tasks from/ })).toBeVisible();
    await card(page, 'RF-17').click();
    await expect(page).toHaveURL(/task=RF-17/);
    const panel = page.getByRole('complementary', { name: /RF-17/ });
    await expect(panel.getByLabel('Title')).toHaveValue('Wheel slip detection');
  });

  test('an edit in the task panel is saved and survives a reload', async ({ page }) => {
    await page.goto('/p/RF?task=RF-17');
    const panel = page.getByRole('complementary', { name: /RF-17/ });
    await panel.getByRole('button', { name: /Priority/ }).click();
    await page.getByRole('option', { name: 'Urgent' }).click();
    await expect(panel.getByRole('list').getByText('set urgent')).toBeVisible();

    await page.reload();
    await expect(
      page
        .getByRole('complementary', { name: /RF-17/ })
        .getByRole('button', { name: /Urgent.*Priority/ }),
    ).toBeVisible();
  });

  test('a card moves to another column with the keyboard alone', async ({ page }) => {
    const target = card(page, 'RF-32');
    await expect(column(page, 'Todo')).toContainText('RF-32');

    // Focus the card, step into its move handle, pick up, Tab to the next column's drop position, drop.
    await target.focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('button', { name: 'Move RF-32' })).toBeFocused();
    await page.keyboard.press('Enter');
    // Tab through drop positions (each is announced) until one is in the In Progress column, then drop there.
    for (let i = 0; i < 20; i++) {
      await page.keyboard.press('Tab');
      const grid = await page.evaluate(
        () => document.activeElement?.closest('[role="grid"]')?.getAttribute('aria-label') ?? '',
      );
      if (grid === 'In Progress tasks') break;
    }
    await page.keyboard.press('Enter');

    await expect(column(page, 'In Progress')).toContainText('RF-32');
    await page.reload();
    await expect(column(page, 'In Progress')).toContainText('RF-32');
  });

  test('quick add from the keyboard creates a task in the shown sprint', async ({ page }) => {
    await page.keyboard.press('c');
    const input = page.getByLabel('New task title');
    await expect(input).toBeFocused();
    await input.fill('Calibrate the bumper switches');
    await input.press('Enter');
    await expect(column(page, 'Todo')).toContainText('Calibrate the bumper switches');
    await page.reload();
    await expect(column(page, 'Todo')).toContainText('Calibrate the bumper switches');
  });

  test('closing the label picker with Escape keeps the labels just picked', async ({ page }) => {
    await page.goto('/p/RF?task=RF-9');
    const panel = page.getByRole('complementary', { name: /RF-9/ });
    const trigger = panel
      .locator('dd')
      .filter({ has: page.getByRole('button') })
      .nth(3);
    await trigger.getByRole('button').click();
    await page.getByRole('option', { name: 'Security' }).click();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('listbox', { name: 'Labels' })).toBeHidden();
    await page.reload();
    await expect(
      page
        .getByRole('complementary', { name: /RF-9/ })
        .getByRole('button', { name: /^Labels:.*Security/ }),
    ).toBeVisible();
  });
});
