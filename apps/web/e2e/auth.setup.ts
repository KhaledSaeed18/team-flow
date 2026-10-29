import { expect, test as setup } from '@playwright/test';
import { E2E } from './env.ts';

/** Sign each person in once through the real form; specs reuse the saved session instead of signing in again. */
for (const [who, credentials] of [
  ['demo', E2E.demo],
  ['maya', E2E.maya],
] as const) {
  setup(`sign in as ${who}`, async ({ page }) => {
    await page.goto('/sign-in');
    await page.getByLabel('Email').fill(credentials.email);
    await page.getByLabel('Password').fill(credentials.password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByRole('navigation', { name: 'Workspace' })).toBeVisible();
    await page.context().storageState({ path: `e2e/.auth/${who}.json` });
  });
}
