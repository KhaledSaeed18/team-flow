import { expect, test } from '@playwright/test';

const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

test('attach files to a task, see them listed with history, and remove one', async ({ page }) => {
  await page.goto('/p/RF?task=RF-12');
  const panel = page.getByRole('complementary', { name: /RF-12/ });
  const files = panel.getByRole('region', { name: 'Attachments' });

  const chooser = page.waitForEvent('filechooser');
  await files.getByRole('button', { name: 'Attach files' }).click();
  await (await chooser).setFiles([
    { name: 'wiring.png', mimeType: 'image/png', buffer: png },
    { name: 'checklist.txt', mimeType: 'text/plain', buffer: Buffer.from('torque the bolts') },
  ]);

  await expect(files.getByRole('link', { name: 'wiring.png', exact: true })).toBeVisible();
  await expect(files.getByRole('link', { name: 'checklist.txt', exact: true })).toBeVisible();
  await expect(files.getByText(/16 B/)).toBeVisible();
  await expect(
    panel.getByRole('region', { name: 'History' }).getByText('attached checklist.txt'),
  ).toBeVisible();

  await files.getByRole('link', { name: 'checklist.txt', exact: true }).hover();
  await files.getByRole('button', { name: 'Remove checklist.txt' }).click();
  await expect(files.getByRole('link', { name: 'checklist.txt', exact: true })).toBeHidden();
  await expect(
    panel.getByRole('region', { name: 'History' }).getByText('removed checklist.txt'),
  ).toBeVisible();
});
