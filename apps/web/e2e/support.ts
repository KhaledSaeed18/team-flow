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

/** Sofia Reyes, the demo workspace's guest. The account journey switches her password between these two. */
export const sofia = { email: 'sofia@northwind.test', password: 'teamflow-demo' };
export const NEW_PASSWORD = 'a brand new passphrase';

/**
 * Sign Sofia in with `password`. With `orPassword`, fall back to it when the first is refused: a retried run
 * starts after the first attempt may already have changed her password.
 */
export async function signInAsSofia(
  browser: Browser,
  password = sofia.password,
  orPassword?: string,
) {
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const page = await context.newPage();
  await page.goto('/sign-in');
  for (const attempt of orPassword ? [password, orPassword] : [password]) {
    await page.getByLabel('Email').fill(sofia.email);
    await page.getByLabel('Password').fill(attempt);
    await page.getByRole('button', { name: 'Sign in' }).click();
    const outcome = await Promise.race([
      page
        .getByRole('navigation', { name: 'Workspace' })
        .waitFor()
        .then(() => 'in' as const),
      page
        .getByRole('alert')
        .waitFor()
        .then(() => 'refused' as const),
    ]);
    if (outcome === 'in') return { page, password: attempt, close: () => context.close() };
  }
  await expect(page.getByRole('navigation', { name: 'Workspace' })).toBeVisible();
  return { page, password, close: () => context.close() };
}
