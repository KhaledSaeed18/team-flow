import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 1280, height: 600 } });

test('long workspace pages scroll inside the shell, and no page overflows the window', async ({
  page,
}) => {
  await page.goto('/settings/audit');
  const last = page.getByRole('listitem').last();
  await last.scrollIntoViewIfNeeded();
  await expect(last).toBeInViewport();

  for (const path of ['/settings/audit', '/inbox', '/settings/members', '/p/RF/backlog', '/p/RF']) {
    await page.goto(path);
    await expect(page.getByRole('navigation', { name: 'Workspace' })).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollHeight - window.innerHeight,
    );
    expect(overflow, path).toBeLessThanOrEqual(1);
  }
});
