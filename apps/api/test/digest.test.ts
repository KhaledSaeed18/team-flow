import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { createHarness, type Harness } from './harness.ts';

describe('digest preference', () => {
  let h: Harness;

  beforeAll(async () => {
    h = await createHarness();
  });
  afterAll(() => h.destroy());

  test('defaults to daily, is personal, and is per workspace', async () => {
    const ada = await h.owner('Ada');
    const grace = await h.join(ada, 'Grace', 'guest');
    expect(await ada.client.notifications.digest()).toEqual({ frequency: 'daily' });

    await grace.client.notifications.setDigest({ frequency: 'weekly' });
    expect(await grace.client.notifications.digest()).toEqual({ frequency: 'weekly' });
    expect(await ada.client.notifications.digest()).toEqual({ frequency: 'daily' });

    await grace.client.notifications.setDigest({ frequency: 'off' });
    expect(await grace.client.notifications.digest()).toEqual({ frequency: 'off' });

    // Grace's own workspace keeps its own setting.
    const own = await grace.authPost('/organization/create', {
      name: 'Grace Co',
      slug: 'grace-co',
    });
    await grace.authPost('/organization/set-active', { organizationId: own.id });
    expect(await grace.client.notifications.digest()).toEqual({ frequency: 'daily' });
  });

  test('rejects unknown frequencies', async () => {
    const linus = await h.owner('Linus');
    await expect(
      linus.client.notifications.setDigest({ frequency: 'hourly' as 'daily' }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });
});
