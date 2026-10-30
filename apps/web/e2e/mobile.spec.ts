import { expect, test } from '@playwright/test';

/** On a phone the sidebar folds into a drawer, and every screen still fits the width of the window. */
test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

const pages = [
  '/p/RF',
  '/p/RF?task=RF-13',
  '/p/RF/list',
  '/p/RF/calendar',
  '/p/RF/backlog',
  '/p/RF/settings',
  '/inbox',
  '/settings/members',
  '/settings/audit',
  '/settings/account',
];

test('every screen fits a phone without sideways scrolling', async ({ page }) => {
  for (const path of pages) {
    await page.goto(path);
    await expect(page.getByRole('button', { name: 'Open navigation' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Workspace' })).toBeHidden();
    const overflow = await page.evaluate(() => ({
      page: document.documentElement.scrollWidth - window.innerWidth,
      // Wide content scrolls in its own pane; nothing inside the main column may push past it.
      main: Math.max(
        0,
        ...[...document.querySelectorAll('main')].map((m) => m.scrollWidth - m.clientWidth),
      ),
    }));
    expect(overflow.page, `${path} overflows sideways`).toBeLessThanOrEqual(1);
    if (!/\/(list|calendar)$|\/p\/RF$/.test(path))
      expect(overflow.main, `${path} content is wider than the screen`).toBeLessThanOrEqual(1);
  }
});

test('the drawer opens, navigates and closes', async ({ page }) => {
  await page.goto('/inbox');
  await page.getByRole('button', { name: 'Open navigation' }).tap();
  const drawer = page.getByRole('dialog', { name: 'Navigation' });
  await expect(drawer.getByRole('navigation', { name: 'Workspace' })).toBeVisible();
  await drawer.getByRole('link', { name: /Rover Firmware/ }).tap();
  await expect(page).toHaveURL(/\/p\/RF$/);
  await expect(drawer).toBeHidden();
  await expect(page.getByRole('heading', { name: 'Rover Firmware' })).toBeVisible();
});

test('a task opens full screen and closes back to the board', async ({ page }) => {
  await page.goto('/p/RF?task=RF-13');
  const panel = page.getByRole('complementary', { name: /RF-13/ });
  await expect(panel).toBeVisible();
  const box = await panel.boundingBox();
  expect(box?.width).toBeCloseTo(390, 0);
  await panel.getByRole('button', { name: 'Close task' }).tap();
  await expect(panel).toBeHidden();
});

// Playwright cannot perform a real long-press drag with a finger. On a phone the board shows one column at a time, so
// the touch-friendly way to move a card is the status picker; the calendar is checked with the pointer at phone size,
// so the layout cannot get in the way of a drop.
test('on a phone, the status picker moves a task without dragging', async ({ page }) => {
  await page.goto('/p/RF?task=RF-21');
  const panel = page.getByRole('complementary', { name: /RF-21/ });
  await panel.getByRole('button', { name: /Status/ }).tap();
  await page.getByRole('option', { name: 'In Review' }).tap();
  await panel.getByRole('button', { name: 'Close task' }).tap();
  await expect(page.getByRole('grid', { name: 'In Review tasks' })).toContainText('RF-21');
});

test('on a phone, a task drags from the tray onto a day', async ({ page }) => {
  await page.goto('/p/RF/calendar');
  const tray = page.getByRole('region', { name: 'Unscheduled' });
  const handle = tray.getByRole('button', { name: /^Reschedule / }).first();
  const identifier = ((await handle.getAttribute('aria-label')) ?? '').replace('Reschedule ', '');
  const now = new Date();
  const day = page.getByRole('region', {
    name: new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      timeZone: 'UTC',
    }).format(Date.UTC(now.getFullYear(), now.getMonth(), 10)),
    exact: true,
  });
  await handle.dragTo(day);
  await expect(day.getByRole('button', { name: new RegExp(`^${identifier} `) })).toBeVisible();
  // Put it back for the specs that run after this one.
  await day.getByRole('button', { name: `Reschedule ${identifier}` }).dragTo(tray);
  await expect(tray.getByRole('button', { name: `Reschedule ${identifier}` })).toBeVisible();
});
