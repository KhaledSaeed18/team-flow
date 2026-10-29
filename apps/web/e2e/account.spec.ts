import { type Browser, expect, test } from '@playwright/test';

const sofia = { email: 'sofia@northwind.test', password: 'teamflow-demo' };

// Fresh sign-ins, so revoking sessions never touches the saved sessions other specs use.
test.use({ storageState: { cookies: [], origins: [] } });

async function signIn(browser: Browser, password = sofia.password) {
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const page = await context.newPage();
  await page.goto('/sign-in');
  await page.getByLabel('Email').fill(sofia.email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('navigation', { name: 'Workspace' })).toBeVisible();
  return { page, close: () => context.close() };
}

test('rename yourself, sign out another device, and change your password', async ({ browser }) => {
  const laptop = await signIn(browser);
  const phone = await signIn(browser);
  const { page } = laptop;

  // Sofia is a guest: no audit log for her.
  await expect(
    page.getByRole('navigation', { name: 'Workspace' }).getByRole('link', { name: 'Audit log' }),
  ).toHaveCount(0);

  await page.goto('/settings/account');
  const name = page.getByRole('textbox', { name: 'Name' });
  await name.fill('Sofia R.');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Profile saved')).toBeVisible();
  await page.reload();
  await expect(name).toHaveValue('Sofia R.');

  const sessions = page.getByRole('region', { name: 'Where you are signed in' });
  await expect(sessions.getByText('This device')).toBeVisible();
  await expect(sessions.getByRole('listitem')).toHaveCount(2);
  await sessions.getByRole('button', { name: 'Sign out of all other devices' }).click();
  await expect(sessions.getByRole('listitem')).toHaveCount(1);
  // The signed-out device notices on its own: its live connection is refused and the app returns to sign-in.
  await expect(phone.page).toHaveURL(/\/sign-in/, { timeout: 15_000 });

  const password = page.getByRole('region', { name: 'Password' });
  await password.getByLabel('Current password').fill('not my password');
  await password.getByLabel('New password').fill('a brand new passphrase');
  await password.getByRole('button', { name: 'Change password' }).click();
  await expect(password.getByText('Your current password is not right.')).toBeVisible();

  await password.getByLabel('Current password').fill(sofia.password);
  await password.getByLabel('New password').fill('a brand new passphrase');
  await password.getByRole('button', { name: 'Change password' }).click();
  await expect(page.getByText('Password changed')).toBeVisible();
  await expect(password.getByLabel('Current password')).toHaveValue('');

  const again = await signIn(browser, 'a brand new passphrase');
  await again.close();
  await laptop.close();
  await phone.close();
});
