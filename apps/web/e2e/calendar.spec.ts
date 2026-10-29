import { expect, test } from '@playwright/test';

const now = new Date();
const label = (day: number) =>
  new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(Date.UTC(now.getFullYear(), now.getMonth(), day));

test('schedule a task by dragging it onto a day, then unschedule it', async ({ page }) => {
  await page.goto('/p/RF/calendar');
  const title = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(now);
  await expect(page.getByRole('heading', { name: title })).toBeVisible();

  const tray = page.getByRole('region', { name: 'Unscheduled' });
  const handle = tray.getByRole('button', { name: /^Reschedule / }).first();
  const identifier = ((await handle.getAttribute('aria-label')) ?? '').replace('Reschedule ', '');
  const day = page.getByRole('region', { name: label(15), exact: true });

  await handle.dragTo(day);
  await expect(day.getByRole('button', { name: new RegExp(`^${identifier} `) })).toBeVisible();
  await expect(tray.getByRole('button', { name: `Reschedule ${identifier}` })).toBeHidden();

  // Saved, not just moved on screen.
  await page.reload();
  await expect(day.getByRole('button', { name: new RegExp(`^${identifier} `) })).toBeVisible();

  await day.getByRole('button', { name: `Reschedule ${identifier}` }).dragTo(tray);
  await expect(tray.getByRole('button', { name: `Reschedule ${identifier}` })).toBeVisible();
  await expect(day.getByRole('button', { name: new RegExp(`^${identifier} `) })).toBeHidden();

  await page.getByRole('button', { name: 'Next month' }).click();
  await expect(page).toHaveURL(/month=/);
  await expect(page.getByRole('heading', { name: title })).toBeHidden();
});
