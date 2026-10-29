import { expect, test } from '@playwright/test';
import { openBoard } from './support.ts';

test.describe('getting around', () => {
  test.beforeEach(async ({ page }) => {
    await openBoard(page);
  });

  test('the command menu finds a task despite a typo and opens it', async ({ page }) => {
    await page.keyboard.press('/');
    const search = page.getByRole('searchbox', { name: 'Search tasks, projects and actions' });
    await search.fill('batery telemtry');
    await expect(page.getByRole('menuitem', { name: /Battery telemetry over CAN/ })).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/task=RF-2\b/);
  });

  test('two-key shortcuts move between views', async ({ page }) => {
    await page.keyboard.press('g');
    await page.keyboard.press('p');
    await expect(page).toHaveURL(/\/p\/RF\/backlog$/);
    await expect(page.getByRole('heading', { name: 'Planning' })).toBeVisible();
    await page.keyboard.press('g');
    await page.keyboard.press('c');
    await expect(page).toHaveURL(/\/p\/RF\/calendar/);
    await page.keyboard.press('g');
    await page.keyboard.press('b');
    await expect(page).toHaveURL(/\/p\/RF$/);
  });

  test('the sprint report replays the seeded history', async ({ page }) => {
    await page.goto('/p/RF/backlog');
    await page.getByRole('link', { name: 'Report' }).first().click();
    await expect(page.getByRole('img', { name: /Burndown for Sprint 4/ })).toBeVisible();
    await expect(page.getByText(/tasks at the start/)).toBeVisible();
    await expect(page.getByRole('img', { name: /Cumulative flow for Sprint 4/ })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Velocity/ })).toContainText(
      'points per sprint',
    );
  });

  test('the inbox has the mention waiting for the demo user', async ({ page }) => {
    await page.getByRole('link', { name: /Inbox/ }).click();
    await expect(page.getByText('Maya Chen mentioned you in RF-13')).toBeVisible();
  });
});

test('the list view sorts by any column and opens a task from the keyboard', async ({ page }) => {
  await page.goto('/p/RF/list?closed=true');
  const table = page.getByRole('grid', { name: 'Rover Firmware tasks' });
  await table.getByRole('columnheader', { name: /Priority/ }).click();
  await expect(page).toHaveURL(/sort=priority/);
  await expect(table.getByRole('row').nth(1)).toContainText('Urgent');

  await page.getByLabel('Filter tasks').fill('slip');
  await expect(table.getByRole('row')).toHaveCount(2);
  await table.getByRole('row').nth(1).focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/task=RF-17/);
});
