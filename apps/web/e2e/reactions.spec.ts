import { expect, test } from '@playwright/test';

test('react to a comment, see who reacted, and take it back', async ({ page }) => {
  await page.goto('/p/RF?task=RF-14');
  const comments = page
    .getByRole('complementary', { name: /RF-14/ })
    .getByRole('region', { name: 'Comments' });
  await comments.getByLabel('Write a comment').fill('Telemetry looks clean on the bench rig.');
  await comments.getByRole('button', { name: 'Comment', exact: true }).click();
  const comment = comments
    .getByRole('listitem')
    .filter({ hasText: 'Telemetry looks clean on the bench rig.' });
  await expect(comment).toBeVisible();

  await comment.getByRole('button', { name: 'Add reaction' }).click();
  await page
    .getByRole('dialog', { name: 'Reactions' })
    .getByRole('button', { name: 'Party' })
    .click();
  const party = comment.getByRole('button', { name: 'Party: Demo User' });
  await expect(party).toHaveAttribute('aria-pressed', 'true');
  await expect(party).toContainText('1');

  // It survives a reload: the server has it, not just the optimistic cache.
  await page.reload();
  await expect(comment.getByRole('button', { name: 'Party: Demo User' })).toBeVisible();
  await comment.getByRole('button', { name: 'Party: Demo User' }).click();
  await expect(comment.getByRole('button', { name: /^Party/ })).toBeHidden();
});
