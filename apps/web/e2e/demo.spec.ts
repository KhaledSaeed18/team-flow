import { mkdir, readdir, rename, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { type Browser, expect, type Page, test } from '@playwright/test';
import { card, column } from './support.ts';

/**
 * The README demo: two people on one board, recorded one above the other. Skipped in normal runs; regenerate with
 * `DEMO=1 bunx playwright test demo`, then `bun e2e/demo-gif.ts` turns the two recordings into the GIF.
 */
test.skip(!process.env.DEMO, 'set DEMO=1 to record the README demo');
test.setTimeout(120_000);

export const DEMO_DIR = fileURLToPath(new URL('../test-results/demo/', import.meta.url));
const size = { width: 1200, height: 660 };

/** A visible pointer and a name tag, since recordings show neither the cursor nor whose screen it is. */
const overlay = (name: string) => `
  addEventListener('DOMContentLoaded', () => {
    const style = document.createElement('style');
    style.textContent = '#demo-cursor{position:fixed;z-index:2147483647;left:0;top:0;width:18px;height:18px;pointer-events:none;transition:transform 30ms linear}#demo-tag{position:fixed;z-index:2147483647;right:12px;bottom:12px;padding:4px 10px;border-radius:999px;background:#1b2430;color:#eef1f4;font:600 12px/1.4 system-ui;pointer-events:none}';
    document.head.append(style);
    const cursor = document.createElement('div');
    cursor.id = 'demo-cursor';
    cursor.innerHTML = '<svg viewBox="0 0 18 18" width="18" height="18"><path d="M2 1l13 7-6 1.5L6 16z" fill="#1b2430" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/></svg>';
    const tag = document.createElement('div');
    tag.id = 'demo-tag';
    tag.textContent = ${JSON.stringify(name)};
    document.body.append(cursor, tag);
    const follow = (e) => { cursor.style.transform = 'translate(' + e.clientX + 'px,' + e.clientY + 'px)'; };
    addEventListener('pointermove', follow, true);
    addEventListener('dragover', follow, true);
  });
`;

async function person(browser: Browser, who: 'demo' | 'maya', name: string) {
  const context = await browser.newContext({
    viewport: size,
    storageState: `e2e/.auth/${who}.json`,
    recordVideo: { dir: `${DEMO_DIR}${who}`, size },
  });
  await context.addInitScript(overlay(name));
  const page = await context.newPage();
  return { page, context };
}

/** Glide the pointer to an element, so the recording shows where it went. */
async function glide(page: Page, target: { boundingBox(): Promise<unknown> }, steps = 20) {
  const box = (await target.boundingBox()) as {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps });
}

test('record the side-by-side demo', async ({ browser }) => {
  await rm(DEMO_DIR, { recursive: true, force: true });
  const [ada, maya] = await Promise.all([
    person(browser, 'demo', 'Demo User'),
    person(browser, 'maya', 'Maya Chen'),
  ]);
  await Promise.all([ada.page.goto('/p/RF'), maya.page.goto('/p/RF')]);
  await expect(maya.page.getByRole('button', { name: /Also viewing: Demo User/ })).toBeVisible();
  // The empty Backlog column comes first; start both boards at the columns with work in them.
  for (const { page } of [ada, maya]) {
    await column(page, 'Todo').scrollIntoViewIfNeeded();
    await page
      .getByRole('region', { name: 'Backlog' })
      .evaluate((lane) =>
        lane.parentElement?.scrollTo({ left: lane.getBoundingClientRect().width }),
      );
  }
  await ada.page.mouse.move(600, 330);
  await ada.page.waitForTimeout(1200);

  // A drag on one screen lands on the other.
  const moving = card(ada.page, 'RF-16');
  await glide(ada.page, moving);
  await ada.page.mouse.down();
  await glide(ada.page, column(ada.page, 'In Review'), 30);
  await ada.page.mouse.up();
  await expect(column(maya.page, 'In Review')).toContainText('RF-16');
  await ada.page.waitForTimeout(1500);

  // Both open the same task and write its description together.
  await glide(ada.page, card(ada.page, 'RF-17'));
  await card(ada.page, 'RF-17').click();
  await glide(maya.page, card(maya.page, 'RF-17'));
  await card(maya.page, 'RF-17').click();
  const mine = ada.page.locator('[aria-label="Description"][contenteditable]');
  const hers = maya.page.locator('[aria-label="Description"][contenteditable]');
  await expect(hers).toContainText('Compare commanded and measured wheel speed.');
  await glide(ada.page, mine);
  await mine.click();
  await ada.page.keyboard.press(process.platform === 'darwin' ? 'Meta+ArrowDown' : 'Control+End');
  await ada.page.keyboard.type(' Flag a slip above 15%.', { delay: 70 });
  await expect(hers).toContainText('Flag a slip above 15%.');
  await maya.page.waitForTimeout(400);
  await hers.click();
  await maya.page.keyboard.press(process.platform === 'darwin' ? 'Meta+ArrowDown' : 'Control+End');
  await maya.page.keyboard.type(' Log every event.', { delay: 70 });
  await expect(mine).toContainText('Log every event.');
  await ada.page.waitForTimeout(1500);

  // Search from anywhere.
  const close = ada.page.getByRole('button', { name: 'Close task' });
  await glide(ada.page, close);
  await close.click();
  await ada.page.keyboard.press('/');
  await ada.page
    .getByRole('searchbox', { name: 'Search tasks, projects and actions' })
    .pressSequentially('telemetry', { delay: 90 });
  await expect(ada.page.getByRole('menuitem').first()).toBeVisible();
  await ada.page.waitForTimeout(2000);

  await Promise.all([ada.context.close(), maya.context.close()]);
  for (const who of ['demo', 'maya']) {
    const [file] = await readdir(`${DEMO_DIR}${who}`);
    if (!file) throw new Error(`no recording for ${who}`);
    await rename(`${DEMO_DIR}${who}/${file}`, `${DEMO_DIR}${who}.webm`);
  }
  await mkdir(DEMO_DIR, { recursive: true });
});
