import { expect, test } from '@playwright/test';
import { anotherPerson, openBoard } from './support.ts';

test('a new notification shows one toast, whatever the window size', async ({ page, browser }) => {
  await openBoard(page);
  const maya = await anotherPerson(browser, 'maya');

  // Maya assigns a task to the demo user through the API the app uses.
  const identifier = await maya.page.evaluate(async () => {
    const rpc = async (path: string, json: unknown) =>
      (
        await fetch(`/rpc/${path}`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ json }),
        }).then((r) => r.json())
      ).json;
    const members = await rpc('members/list', {});
    const demo = members.find((m: { name: string }) => m.name === 'Demo User');
    const task = await rpc('tasks/getByIdentifier', { identifier: 'RF-25' });
    await rpc('tasks/update', { id: task.id, version: task.version, assigneeMemberId: demo.id });
    return task.identifier;
  });
  expect(identifier).toBe('RF-25');

  const toast = page.getByText(`Maya Chen assigned you ${identifier}`);
  await expect(toast.first()).toBeVisible();
  // A duplicate would come from a second listener on the same event, a moment later: give it time, then count.
  await page.waitForTimeout(1000);
  await expect(toast).toHaveCount(1);
  await maya.close();
});
