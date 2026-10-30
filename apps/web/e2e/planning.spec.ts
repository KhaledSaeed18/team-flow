import { expect, type Page, test } from '@playwright/test';

/** Sprint planning: work moves between the backlog and a sprint, by keyboard as well as by mouse. */

const section = (page: Page, name: string) => page.getByRole('grid', { name, exact: true });
const row = (page: Page, identifier: string) =>
  page.getByRole('row', { name: new RegExp(`^${identifier} `) });

/** Pick a row up by its handle, Tab through the drop positions until one is in `target`, and drop. */
async function moveByKeyboard(page: Page, identifier: string, target: string) {
  await row(page, identifier).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('button', { name: `Move ${identifier}` })).toBeFocused();
  await page.keyboard.press('Enter');
  for (let i = 0; i < 30; i++) {
    await page.keyboard.press('Tab');
    const grid = await page.evaluate(() => {
      const labelledBy = document.activeElement
        ?.closest('[role="grid"]')
        ?.getAttribute('aria-labelledby');
      return labelledBy ? (document.getElementById(labelledBy)?.textContent ?? '') : '';
    });
    if (grid === target) break;
  }
  await page.keyboard.press('Enter');
}

test('a task moves into a sprint and back to the backlog with the keyboard alone', async ({
  page,
}) => {
  const warnings: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'warning' && m.text().includes('slot="drag"')) warnings.push(m.text());
  });
  await page.goto('/p/RF/backlog');
  await expect(section(page, 'Backlog')).toContainText('RF-23');

  await moveByKeyboard(page, 'RF-23', 'Sprint 4');
  await expect(section(page, 'Sprint 4')).toContainText('RF-23');
  await page.reload();
  await expect(section(page, 'Sprint 4')).toContainText('RF-23');

  await moveByKeyboard(page, 'RF-23', 'Backlog');
  await expect(section(page, 'Backlog')).toContainText('RF-23');
  expect(warnings, 'every draggable row has a drag handle').toEqual([]);
});
