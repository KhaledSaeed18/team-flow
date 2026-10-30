import { expect, test } from '@playwright/test';
import { NEW_PASSWORD, signInAsSofia as signIn, sofia } from './support.ts';

// Fresh sign-ins, so revoking sessions never touches the saved sessions other specs use.
test.use({ storageState: { cookies: [], origins: [] } });

test('rename yourself, sign out another device, and change your password', async ({ browser }) => {
  // Several sign-ins and a forced sign-out: slower than most, especially on a cold CI runner.
  test.slow();
  const laptop = await signIn(browser, sofia.password, NEW_PASSWORD);
  const current = laptop.password;
  const phone = await signIn(browser, current);
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
  // At least this device and the phone; a retried run may find sessions left by the first attempt.
  await expect(sessions.getByRole('listitem').nth(1)).toBeVisible();
  await sessions.getByRole('button', { name: 'Sign out of all other devices' }).click();
  await expect(sessions.getByRole('listitem')).toHaveCount(1);
  // The signed-out device notices on its own: its live connection is refused and the app returns to sign-in.
  await expect(phone.page).toHaveURL(/\/sign-in/, { timeout: 15_000 });

  const password = page.getByRole('region', { name: 'Password' });
  await password.getByLabel('Current password').fill('not my password');
  await password.getByLabel('New password').fill('a brand new passphrase');
  await password.getByRole('button', { name: 'Change password' }).click();
  await expect(password.getByText('Your current password is not right.')).toBeVisible();

  const next = current === NEW_PASSWORD ? sofia.password : NEW_PASSWORD;
  await password.getByLabel('Current password').fill(current);
  await password.getByLabel('New password').fill(next);
  await password.getByRole('button', { name: 'Change password' }).click();
  await expect(page.getByText('Password changed')).toBeVisible();
  await expect(password.getByLabel('Current password')).toHaveValue('');

  const again = await signIn(browser, next);
  await again.close();
  await laptop.close();
  await phone.close();
});
