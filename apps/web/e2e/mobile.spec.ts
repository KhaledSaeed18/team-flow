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
