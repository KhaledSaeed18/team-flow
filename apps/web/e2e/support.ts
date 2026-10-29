import { type Browser, expect, type Page } from '@playwright/test';

/** Open the Rover Firmware board (the session comes from the setup project). */
export async function openBoard(page: Page) {
  await page.goto('/p/RF');
  await expect(page.getByRole('heading', { name: 'Rover Firmware', level: 1 })).toBeVisible();
}

/** A second, independent person in their own browser context, signed in with their saved session. */
export async function anotherPerson(browser: Browser, who: 'maya') {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    storageState: `e2e/.auth/${who}.json`,
  });
  const page = await context.newPage();
  await openBoard(page);
  return { page, close: () => context.close() };
}

export const column = (page: Page, name: string) =>
  page.getByRole('grid', { name: `${name} tasks` });
export const card = (page: Page, identifier: string) =>
  page.getByRole('row', { name: new RegExp(`^${identifier} `) });
