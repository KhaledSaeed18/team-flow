import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { createHarness, type Harness } from './harness.ts';

describe('saved views', () => {
  let h: Harness;
  let ada: Awaited<ReturnType<Harness['owner']>>;
  let linus: Awaited<ReturnType<Harness['join']>>;
  let grace: Awaited<ReturnType<Harness['join']>>;
  let projectId: string;

  beforeAll(async () => {
    h = await createHarness();
    ada = await h.owner('Ada');
    linus = await h.join(ada, 'Linus', 'member');
    grace = await h.join(ada, 'Grace', 'guest');
    projectId = (await ada.client.projects.create({ key: 'VW', name: 'Views' })).id;
  });
  afterAll(() => h.destroy());

  test('private views are yours alone; shared ones are everyone’s', async () => {
    const mine = await linus.client.views.create({
      projectId,
      name: 'My urgent work',
      filter: { assignee: ['me'], priority: ['urgent', 'high'] },
      sort: 'priority',
      direction: 'ascending',
    });
    expect(mine).toMatchObject({ shared: false, mine: true, canDelete: true, ownerName: 'Linus' });
    await linus.client.views.create({ projectId, name: 'Bugs', shared: true, filter: {} });

    expect((await linus.client.views.list({ projectId })).map((v) => v.name)).toEqual([
      'Bugs',
      'My urgent work',
    ]);
    const seenByAda = await ada.client.views.list({ projectId });
    expect(seenByAda).toMatchObject([{ name: 'Bugs', mine: false, canDelete: true }]);
    expect(await grace.client.views.list({ projectId })).toMatchObject([
      { name: 'Bugs', mine: false, canDelete: false },
    ]);

    // Someone else's private view is invisible, not forbidden.
    await expect(ada.client.views.delete({ id: mine.id })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  test('only the owner edits; versions guard concurrent edits; names are unique per owner', async () => {
    const view = await ada.client.views.create({ projectId, name: 'Triage', filter: {} });
    const renamed = await ada.client.views.update({
      id: view.id,
      version: view.version,
      name: 'Triage queue',
      filter: { assignee: ['none'] },
      shared: true,
    });
    expect(renamed).toMatchObject({ name: 'Triage queue', version: 2, shared: true });
    expect(renamed.filter).toEqual({ assignee: ['none'] });

    await expect(
      ada.client.views.update({ id: view.id, version: 1, name: 'Stale' }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    await expect(
      linus.client.views.update({ id: view.id, version: 2, name: 'Mine now' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(
      ada.client.views.create({ projectId, name: 'Triage queue', filter: {} }),
    ).rejects.toMatchObject({ code: 'NAME_TAKEN' });
    // Another person may reuse the name.
    await linus.client.views.create({ projectId, name: 'Triage queue', filter: {} });
  });

  test('guests keep private views but cannot share; admins may remove shared views', async () => {
    await grace.client.views.create({ projectId, name: 'Reading list', filter: {} });
    await expect(
      grace.client.views.create({ projectId, name: 'For all', shared: true, filter: {} }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });

    const shared = await linus.client.views.create({
      projectId,
      name: 'Shared by Linus',
      shared: true,
      filter: {},
    });
    await expect(grace.client.views.delete({ id: shared.id })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    await ada.client.views.delete({ id: shared.id });
    expect((await linus.client.views.list({ projectId })).map((v) => v.name)).not.toContain(
      'Shared by Linus',
    );
  });

  test('filters are validated, and other workspaces see nothing', async () => {
    await expect(
      ada.client.views.create({
        projectId,
        name: 'Bad',
        filter: { priority: ['whenever' as 'high'] },
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });

    const eve = await h.owner('Eve');
    await expect(eve.client.views.list({ projectId })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    const [any] = await ada.client.views.list({ projectId });
    await expect(eve.client.views.delete({ id: any?.id ?? '' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});
