import { expect, test } from '@playwright/test';

/**
 * A layout guard. Every screen fills the window without the page itself scrolling, in either direction, at a
 * desktop and a small-laptop width. Wide content (the list, the board) scrolls inside its own pane. Pixel diffs
 * would differ between macOS and the Linux CI, so this checks the rule instead.
 */
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

for (const [width, height] of [
  [1440, 900],
  [1024, 720],
] as const) {
  test(`every screen fits a ${width}×${height} window`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    for (const path of pages) {
      await page.goto(path);
      await expect(page.getByRole('navigation', { name: 'Workspace' })).toBeVisible();
      const overflow = await page.evaluate(() => ({
        x: document.documentElement.scrollWidth - window.innerWidth,
        y: document.documentElement.scrollHeight - window.innerHeight,
      }));
      expect(overflow.x, `${path} overflows sideways`).toBeLessThanOrEqual(1);
      expect(overflow.y, `${path} overflows downwards`).toBeLessThanOrEqual(1);
    }
  });
}

test('the list keeps titles readable on a small laptop and scrolls sideways for the rest', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1024, height: 720 });
  await page.goto('/p/RF/list');
  const title = page.getByRole('columnheader', { name: /Title/ });
  expect((await title.boundingBox())?.width ?? 0).toBeGreaterThanOrEqual(259);
  const grid = page.getByRole('grid');
  expect(await grid.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
});
