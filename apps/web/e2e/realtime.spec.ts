import { expect, test } from '@playwright/test';
import { anotherPerson, card, column, openBoard } from './support.ts';

test('two people on one board see each other and each other’s moves', async ({ page, browser }) => {
  await openBoard(page);
  const maya = await anotherPerson(browser, 'maya');

  // Presence: each sees the other in the project header.
  await expect(page.getByRole('button', { name: /Also viewing: Maya Chen/ })).toBeVisible();
  await expect(maya.page.getByRole('button', { name: /Also viewing: Demo User/ })).toBeVisible();

  // Maya opens a task: the demo user sees her avatar on that card.
  await maya.page.goto('/p/RF?task=RF-18');
  await expect(card(page, 'RF-18').getByText('Open by Maya Chen')).toBeAttached();

  // Maya moves a card through the API the board uses; it lands on the demo user's board without a reload.
  const moved = await maya.page.evaluate(async () => {
    const rpc = async (path: string, json: unknown) =>
      (
        await fetch(`/rpc/${path}`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ json }),
        }).then((r) => r.json())
      ).json;
    const task = await rpc('tasks/getByIdentifier', { identifier: 'RF-16' });
    const project = await rpc('projects/get', { id: task.projectId });
    const review = project.statuses.find((s: { name: string }) => s.name === 'In Review').id;
    return (await rpc('tasks/move', { id: task.id, version: task.version, statusId: review }))
      .identifier;
  });
  expect(moved).toBe('RF-16');
  await expect(column(page, 'In Review')).toContainText('RF-16');

  await maya.close();
  await expect(page.getByRole('button', { name: /Also viewing: Maya Chen/ })).toBeHidden();
});

// End only reaches the end of the visual line, and the description wraps in the panel; this reaches the end of
// the document wherever the click landed.
const DOC_END = process.platform === 'darwin' ? 'Meta+ArrowDown' : 'Control+End';

test('two people edit a description together and see each other’s caret', async ({
  page,
  browser,
}) => {
  await page.goto('/p/RF?task=RF-17');
  const maya = await anotherPerson(browser, 'maya');
  await maya.page.goto('/p/RF?task=RF-17');

  const mine = page.locator('[aria-label="Description"][contenteditable]');
  const hers = maya.page.locator('[aria-label="Description"][contenteditable]');
  await expect(mine).toContainText('Compare commanded and measured wheel speed.');
  await expect(hers).toContainText('Compare commanded and measured wheel speed.');

  await mine.click();
  await page.keyboard.press(DOC_END);
  await page.keyboard.type(' Threshold 15%.');
  await expect(hers).toContainText('Threshold 15%.');
  await expect(
    maya.page.locator('.collaboration-carets__label', { hasText: 'Demo User' }),
  ).toBeVisible();

  await hers.click();
  await maya.page.keyboard.press(DOC_END);
  await maya.page.keyboard.type(' Log every slip event.');
  await expect(mine).toContainText('Threshold 15%. Log every slip event.');
  await maya.close();
});
