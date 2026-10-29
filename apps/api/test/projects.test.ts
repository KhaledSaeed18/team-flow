import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { activity, outbox } from '@teamflow/db/schema';
import { eq } from 'drizzle-orm';
import { createHarness, type Harness } from './harness.ts';

describe('projects', () => {
  let h: Harness;
  let ada: Awaited<ReturnType<Harness['owner']>>;

  beforeAll(async () => {
    h = await createHarness();
    ada = await h.owner('Ada');
  });
  afterAll(() => h.destroy());

  test('creating a project gives it the default workflow, in board order', async () => {
    const project = await ada.client.projects.create({ key: 'TF', name: 'TeamFlow' });
    expect(project).toMatchObject({ key: 'TF', name: 'TeamFlow', version: 1, archivedAt: null });
    expect(project.statuses.map((s) => [s.name, s.category])).toEqual([
      ['Backlog', 'backlog'],
      ['Todo', 'unstarted'],
      ['In Progress', 'started'],
      ['In Review', 'started'],
      ['Done', 'completed'],
      ['Canceled', 'canceled'],
    ]);
    const ranks = project.statuses.map((s) => s.rank);
    expect([...ranks].sort()).toEqual(ranks);
  });

  test('creation is recorded in the activity log and the outbox, in the same transaction', async () => {
    const project = await ada.client.projects.create({ key: 'OPS', name: 'Operations' });
    const events = await h.db
      .select()
      .from(outbox)
      .where(eq(outbox.organizationId, ada.organizationId));
    expect(
      events.some((e) => e.topic === 'project.created' && e.payload.projectId === project.id),
    ).toBe(true);
    const log = await h.db.select().from(activity).where(eq(activity.projectId, project.id));
    expect(log.map((a) => a.kind)).toEqual(['project.created']);
  });

  test('keys are unique per organization', async () => {
    await ada.client.projects.create({ key: 'DUP', name: 'First' });
    await expect(ada.client.projects.create({ key: 'DUP', name: 'Second' })).rejects.toMatchObject({
      code: 'KEY_TAKEN',
      status: 409,
    });
    const grace = await h.owner('Grace');
    await expect(
      grace.client.projects.create({ key: 'DUP', name: 'Elsewhere' }),
    ).resolves.toBeDefined();
  });

  test('invalid input is rejected before reaching the service', async () => {
    await expect(ada.client.projects.create({ key: 'lower', name: 'x' })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
  });

  test('updates need the current version; a stale one is a conflict carrying the new version', async () => {
    const project = await ada.client.projects.create({ key: 'VER', name: 'Versioned' });
    const updated = await ada.client.projects.update({
      id: project.id,
      version: 1,
      name: 'Renamed',
    });
    expect(updated).toMatchObject({ name: 'Renamed', version: 2 });

    await expect(
      ada.client.projects.update({ id: project.id, version: 1, name: 'Lost update' }),
    ).rejects.toMatchObject({ code: 'CONFLICT', data: { currentVersion: 2 } });

    const log = await h.db.select().from(activity).where(eq(activity.projectId, project.id));
    expect(log.find((a) => a.kind === 'project.updated')?.changes).toEqual([
      { field: 'name', from: 'Versioned', to: 'Renamed' },
    ]);
  });

  test('archived projects drop out of the default list and can be restored', async () => {
    const project = await ada.client.projects.create({ key: 'ARC', name: 'Archive me' });
    const archived = await ada.client.projects.archive({
      id: project.id,
      version: project.version,
    });
    expect(archived.archivedAt).toEqual(h.clock.now());

    const visible = await ada.client.projects.list();
    expect(visible.map((p) => p.key)).not.toContain('ARC');
    const all = await ada.client.projects.list({ includeArchived: true });
    expect(all.map((p) => p.key)).toContain('ARC');

    const restored = await ada.client.projects.restore({
      id: project.id,
      version: archived.version,
    });
    expect(restored.archivedAt).toBeNull();
  });

  describe('roles', () => {
    test('members create and edit projects but cannot archive them', async () => {
      const linus = await h.join(ada, 'Linus', 'member');
      const project = await linus.client.projects.create({ key: 'MEM', name: 'By a member' });
      await linus.client.projects.update({ id: project.id, version: 1, name: 'Edited' });
      await expect(
        linus.client.projects.archive({ id: project.id, version: 2 }),
      ).rejects.toMatchObject({
        code: 'FORBIDDEN',
      });
    });

    test('guests can read but not create', async () => {
      const guest = await h.join(ada, 'Guest', 'guest');
      expect((await guest.client.projects.list()).length).toBeGreaterThan(0);
      await expect(
        guest.client.projects.create({ key: 'GST', name: 'Nope' }),
      ).rejects.toMatchObject({
        code: 'FORBIDDEN',
      });
    });
  });

  describe('isolation', () => {
    test("another organization's project is not found — for reads and for writes", async () => {
      const project = await ada.client.projects.create({ key: 'SEC', name: 'Secret' });
      const mallory = await h.owner('Mallory');

      expect(
        (await mallory.client.projects.list({ includeArchived: true })).map((p) => p.id),
      ).not.toContain(project.id);
      await expect(mallory.client.projects.get({ id: project.id })).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
      await expect(
        mallory.client.projects.update({ id: project.id, version: 1, name: 'pwned' }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
      await expect(
        mallory.client.projects.archive({ id: project.id, version: 1 }),
      ).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
      expect((await ada.client.projects.get({ id: project.id })).name).toBe('Secret');
    });

    test('without an active organization there is nothing to read', async () => {
      const loner = await h.user('Loner');
      await expect(loner.client.projects.list()).rejects.toMatchObject({
        code: 'NO_ACTIVE_ORGANIZATION',
      });
    });

    test('a removed member loses access immediately, even with a live session', async () => {
      const temp = await h.join(ada, 'Temp', 'member');
      expect((await temp.client.projects.list()).length).toBeGreaterThan(0);
      const me = await temp.client.me.get();
      await ada.authPost('/organization/remove-member', {
        memberIdOrEmail: me.user.email,
        organizationId: ada.organizationId,
      });
      await expect(temp.client.projects.list()).rejects.toMatchObject({
        code: 'NO_ACTIVE_ORGANIZATION',
      });
    });
  });
});

describe('search', () => {
  test('finds tasks by words and identifiers, only in the caller’s organization', async () => {
    const h = await createHarness();
    const ada = await h.owner('Ada');
    const project = await ada.client.projects.create({ key: 'SRC', name: 'Search' });
    const task = await ada.client.tasks.create({
      projectId: project.id,
      title: 'Lidar driver timeouts',
    });
    expect((await ada.client.search.tasks({ q: 'lidar time' })).map((t) => t.identifier)).toEqual([
      task.identifier,
    ]);
    expect((await ada.client.search.tasks({ q: task.identifier }))[0]?.id).toBe(task.id);
    const mallory = await h.owner('Mallory');
    expect(await mallory.client.search.tasks({ q: 'lidar' })).toEqual([]);
    await h.destroy();
  });
});
