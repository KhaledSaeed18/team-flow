import { fileURLToPath } from 'node:url';
import { expect, type Page, test } from '@playwright/test';

/**
 * Product screenshots for the site, taken from the seeded demo workspace. Skipped in normal runs; regenerate with
 * `SCREENSHOTS=1 bunx playwright test screenshots`.
 */
test.skip(!process.env.SCREENSHOTS, 'set SCREENSHOTS=1 to regenerate the site screenshots');
test.use({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });

const out = (name: string) =>
  fileURLToPath(new URL(`../../site/public/screenshots/${name}.png`, import.meta.url));
const settle = (page: Page) => page.waitForTimeout(400);

test('board with a task open', async ({ page }) => {
  await page.goto('/p/RF?task=RF-13');
  await expect(page.getByRole('complementary', { name: /RF-13/ })).toBeVisible();
  await settle(page);
  await page.screenshot({ path: out('board') });
});

test('list with filters', async ({ page }) => {
  await page.goto('/p/RF/list?closed=true&sort=priority');
  await expect(page.getByRole('grid')).toBeVisible();
  await settle(page);
  await page.screenshot({ path: out('list') });
});

test('calendar', async ({ page }) => {
  await page.goto('/p/RF/calendar');
  await expect(page.getByRole('region', { name: 'Unscheduled' })).toBeVisible();
  await settle(page);
  await page.screenshot({ path: out('calendar') });
});

test('sprint report', async ({ page }) => {
  await page.goto('/p/RF/backlog');
  await page.getByRole('link', { name: 'Report' }).first().click();
  await expect(page.getByRole('img', { name: /Cumulative flow/ })).toBeVisible();
  await settle(page);
  await page.screenshot({ path: out('report'), fullPage: true });
});

test('planning', async ({ page }) => {
  await page.goto('/p/RF/backlog');
  await expect(page.getByRole('link', { name: 'Report' }).first()).toBeVisible();
  await settle(page);
  await page.screenshot({ path: out('planning') });
});

test('command palette', async ({ page }) => {
  await page.goto('/p/RF');
  await page.getByRole('grid').first().waitFor();
  await page.keyboard.press('/');
  await page
    .getByRole('searchbox', { name: 'Search tasks, projects and actions' })
    .fill('telemetry');
  await expect(page.getByRole('menuitem').first()).toBeVisible();
  await settle(page);
  await page.screenshot({ path: out('palette') });
});

test('board in the dark', async ({ page }) => {
  await page.goto('/p/RF');
  await page.evaluate(() => document.documentElement.classList.add('dark'));
  await page.getByRole('grid').first().waitFor();
  await settle(page);
  await page.screenshot({ path: out('board-dark') });
});
