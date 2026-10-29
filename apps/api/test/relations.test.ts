import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { createHarness, type Harness } from './harness.ts';

describe('task relations', () => {
  let h: Harness;
  let ada: Awaited<ReturnType<Harness['owner']>>;
  let projectId: string;
  let otherProjectId: string;
  const task = (title: string, project = projectId) =>
    ada.client.tasks.create({ projectId: project, title });

  beforeAll(async () => {
    h = await createHarness();
    ada = await h.owner('Ada');
    projectId = (await ada.client.projects.create({ key: 'REL', name: 'Relations' })).id;
    otherProjectId = (await ada.client.projects.create({ key: 'OTR', name: 'Other' })).id;
  });
  afterAll(() => h.destroy());

  test('blocks reads as "blocked by" from the other side, across projects', async () => {
    const api = await task('Ship API');
    const ui = await task('Ship UI', otherProjectId);
    await ada.client.relations.add({ taskId: ui.id, kind: 'blocked_by', otherTaskId: api.id });

    expect(await ada.client.relations.list({ taskId: api.id })).toMatchObject([
      { type: 'blocks', direction: 'outgoing', task: { identifier: ui.identifier } },
    ]);
    expect(await ada.client.relations.list({ taskId: ui.id })).toMatchObject([
      {
        type: 'blocks',
        direction: 'incoming',
        task: { identifier: api.identifier, statusCategory: 'unstarted' },
      },
    ]);
    const history = await ada.client.tasks.history({ id: ui.id });
    expect(history.at(-1)?.kind).toBe('task.related');
  });

  test('symmetric relations are stored once; repeats are no-ops; mutual blocking is refused', async () => {
    const a = await task('A');
    const b = await task('B');
    const first = await ada.client.relations.add({
      taskId: a.id,
      kind: 'relates',
      otherTaskId: b.id,
    });
    const again = await ada.client.relations.add({
      taskId: b.id,
      kind: 'relates',
      otherTaskId: a.id,
    });
    expect(again.id).toBe(first.id);
    expect(await ada.client.relations.list({ taskId: a.id })).toHaveLength(1);

    await ada.client.relations.add({ taskId: a.id, kind: 'blocks', otherTaskId: b.id });
    await expect(
      ada.client.relations.add({ taskId: b.id, kind: 'blocks', otherTaskId: a.id }),
    ).rejects.toMatchObject({
      code: 'INVALID_REFERENCE',
    });
    await expect(
      ada.client.relations.add({ taskId: a.id, kind: 'relates', otherTaskId: a.id }),
    ).rejects.toMatchObject({
      code: 'INVALID_REFERENCE',
    });
  });

  test('removing a relation removes it from both sides', async () => {
    const a = await task('Remove A');
    const b = await task('Remove B');
    const { id } = await ada.client.relations.add({
      taskId: a.id,
      kind: 'duplicates',
      otherTaskId: b.id,
    });
    await ada.client.relations.remove({ id });
    expect(await ada.client.relations.list({ taskId: a.id })).toEqual([]);
    expect(await ada.client.relations.list({ taskId: b.id })).toEqual([]);
  });

  test('guests cannot relate; another organization cannot see or link', async () => {
    const a = await task('Guarded');
    const b = await task('Guarded too');
    const guest = await h.join(ada, 'Guest', 'guest');
    await expect(
      guest.client.relations.add({ taskId: a.id, kind: 'relates', otherTaskId: b.id }),
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });

    const mallory = await h.owner('Mallory');
    const theirs = await mallory.client.tasks.create({
      projectId: (await mallory.client.projects.create({ key: 'MAL', name: 'Mal' })).id,
      title: 'Theirs',
    });
    await expect(mallory.client.relations.list({ taskId: a.id })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    await expect(
      mallory.client.relations.add({ taskId: theirs.id, kind: 'blocks', otherTaskId: a.id }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
