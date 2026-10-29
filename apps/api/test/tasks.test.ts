import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import type { Outputs } from '@teamflow/contract';
import { createHarness, type Harness } from './harness.ts';

type Project = Outputs['projects']['create'];
type Owner = Awaited<ReturnType<Harness['owner']>>;

const statusNamed = (project: Project, name: string) => {
  const status = project.statuses.find((s) => s.name === name);
  if (!status) throw new Error(`no status ${name}`);
  return status.id;
};

describe('tasks', () => {
  let h: Harness;
  let ada: Owner;
  let project: Project;

  beforeAll(async () => {
    h = await createHarness();
    ada = await h.owner('Ada');
    project = await ada.client.projects.create({ key: 'TF', name: 'TeamFlow' });
  });
  afterAll(() => h.destroy());

  const create = (
    title: string,
    extra: Partial<Parameters<Owner['client']['tasks']['create']>[0]> = {},
  ) => ada.client.tasks.create({ projectId: project.id, title, ...extra });

  describe('creating', () => {
    test('numbers tasks per project and lands them in Todo', async () => {
      const first = await create('First');
      const second = await create('Second');
      expect([first.identifier, second.identifier]).toEqual([
        `TF-${first.number}`,
        `TF-${first.number + 1}`,
      ]);
      expect(first.statusId).toBe(statusNamed(project, 'Todo'));
      expect(first).toMatchObject({ priority: 'none', version: 1, labelIds: [], startedAt: null });
    });

    test('concurrent creates never share a number', async () => {
      const created = await Promise.all(
        Array.from({ length: 12 }, (_, i) => create(`Parallel ${i}`)),
      );
      const numbers = created.map((t) => t.number);
      expect(new Set(numbers).size).toBe(numbers.length);
    });

    test('appends to the end of its column', async () => {
      const a = await create('Column A');
      const b = await create('Column B');
      expect(a.rank < b.rank).toBe(true);
    });

    test('honours a client-generated id', async () => {
      const id = '01900000-0000-7000-8000-000000000001';
      expect((await create('Optimistic', { id })).id).toBe(id);
    });

    test('created directly in a started status stamps startedAt', async () => {
      const task = await create('Already going', { statusId: statusNamed(project, 'In Progress') });
      expect(task.startedAt).toEqual(h.clock.now());
    });

    test('rejects a status from another project', async () => {
      const other = await ada.client.projects.create({ key: 'OTH', name: 'Other' });
      await expect(
        create('Wrong status', { statusId: statusNamed(other, 'Todo') }),
      ).rejects.toMatchObject({
        code: 'INVALID_REFERENCE',
        status: 422,
      });
    });

    test('rejects an assignee who is not a member of this organization', async () => {
      const grace = await h.owner('Grace');
      const graceMe = await grace.client.me.get();
      expect(graceMe.organizations).toHaveLength(1);
      await expect(
        create('Wrong assignee', { assigneeMemberId: '01900000-0000-7000-8000-0000000000aa' }),
      ).rejects.toMatchObject({ code: 'INVALID_REFERENCE' });
    });

    test('archived projects are read-only', async () => {
      const archived = await ada.client.projects.create({ key: 'OLD', name: 'Old' });
      await ada.client.projects.archive({ id: archived.id, version: 1 });
      await expect(
        ada.client.tasks.create({ projectId: archived.id, title: 'Too late' }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });
  });

  describe('moving on the board', () => {
    test('places a task between two neighbours', async () => {
      const done = statusNamed(project, 'Done');
      const a = await create('Move A', { statusId: done });
      const c = await create('Move C', { statusId: done });
      const b = await create('Move B');
      const moved = await ada.client.tasks.move({
        id: b.id,
        version: b.version,
        statusId: done,
        afterId: a.id,
        beforeId: c.id,
      });
      expect(moved.rank > a.rank && moved.rank < c.rank).toBe(true);
      const column = await ada.client.tasks.list({ projectId: project.id, statusIds: [done] });
      const order = column.map((t) => t.title).filter((t) => t.startsWith('Move'));
      expect(order).toEqual(['Move A', 'Move B', 'Move C']);
    });

    test('with only one neighbour, slots in next to it', async () => {
      const review = statusNamed(project, 'In Review');
      const x = await create('Slot X', { statusId: review });
      const z = await create('Slot Z', { statusId: review });
      const y = await create('Slot Y');
      await ada.client.tasks.move({
        id: y.id,
        version: y.version,
        statusId: review,
        afterId: x.id,
      });
      const order = (await ada.client.tasks.list({ projectId: project.id, statusIds: [review] }))
        .map((t) => t.title)
        .filter((t) => t.startsWith('Slot'));
      expect(order).toEqual(['Slot X', 'Slot Y', 'Slot Z']);
      expect(z).toBeDefined();
    });

    test('to the top of a column', async () => {
      const backlog = statusNamed(project, 'Backlog');
      const existing = await create('Top existing', { statusId: backlog });
      const task = await create('Top new');
      const moved = await ada.client.tasks.move({
        id: task.id,
        version: task.version,
        statusId: backlog,
        afterId: null,
      });
      expect(moved.rank < existing.rank).toBe(true);
    });

    test('rejects neighbours from another column', async () => {
      const a = await create('Neighbour elsewhere');
      const b = await create('Mover');
      await expect(
        ada.client.tasks.move({
          id: b.id,
          version: b.version,
          statusId: statusNamed(project, 'Done'),
          afterId: a.id,
        }),
      ).rejects.toMatchObject({ code: 'INVALID_REFERENCE' });
    });

    test('lifecycle follows the status category', async () => {
      const task = await create('Lifecycle');
      const started = await ada.client.tasks.move({
        id: task.id,
        version: task.version,
        statusId: statusNamed(project, 'In Progress'),
      });
      expect(started.startedAt).toEqual(h.clock.now());

      h.clock.advance(3_600_000);
      const done = await ada.client.tasks.move({
        id: task.id,
        version: started.version,
        statusId: statusNamed(project, 'Done'),
      });
      expect(done.startedAt).toEqual(started.startedAt);
      expect(done.completedAt).toEqual(h.clock.now());
    });
  });

  describe('updating', () => {
    test('patches fields and bumps the version', async () => {
      const task = await create('Patch me');
      const updated = await ada.client.tasks.update({
        id: task.id,
        version: task.version,
        title: 'Patched',
        priority: 'high',
        estimate: 5,
        dueDate: '2026-04-01',
      });
      expect(updated).toMatchObject({
        title: 'Patched',
        priority: 'high',
        estimate: 5,
        dueDate: '2026-04-01',
        version: 2,
      });
    });

    test('concurrent edits: exactly one wins, the other gets the version to reload', async () => {
      const task = await create('Race');
      const results = await Promise.allSettled([
        ada.client.tasks.update({ id: task.id, version: 1, title: 'Left' }),
        ada.client.tasks.update({ id: task.id, version: 1, title: 'Right' }),
      ]);
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      const failure = results.find((r) => r.status === 'rejected');
      expect(failure?.status === 'rejected' && failure.reason).toMatchObject({
        code: 'CONFLICT',
        data: { currentVersion: 2 },
      });
    });

    test('sub-tasks stay in the project and cannot form a cycle', async () => {
      const parent = await create('Parent');
      const child = await create('Child', { parentTaskId: parent.id });
      expect(child.parentTaskId).toBe(parent.id);
      await expect(
        ada.client.tasks.update({ id: parent.id, version: parent.version, parentTaskId: child.id }),
      ).rejects.toMatchObject({ code: 'INVALID_REFERENCE' });
      const subtasks = await ada.client.tasks.list({
        projectId: project.id,
        parentTaskId: parent.id,
      });
      expect(subtasks.map((t) => t.id)).toEqual([child.id]);
    });
  });

  describe('history', () => {
    test('records every change field by field', async () => {
      const task = await create('Tracked');
      const v2 = await ada.client.tasks.update({
        id: task.id,
        version: 1,
        title: 'Tracked!',
        priority: 'low',
      });
      await ada.client.tasks.move({
        id: task.id,
        version: v2.version,
        statusId: statusNamed(project, 'Done'),
      });

      const history = await ada.client.tasks.history({ id: task.id });
      expect(history.map((e) => e.kind)).toEqual(['task.created', 'task.updated', 'task.moved']);
      expect(history[1]?.changes).toEqual([
        { field: 'title', from: 'Tracked', to: 'Tracked!' },
        { field: 'priority', from: 'none', to: 'low' },
      ]);
      expect(history[2]?.changes[0]).toMatchObject({
        field: 'status',
        from: { category: 'unstarted' },
        to: { category: 'completed' },
      });
    });
  });

  describe('lookup and delete', () => {
    test('by identifier, case-insensitively', async () => {
      const task = await create('Find me');
      expect(
        (await ada.client.tasks.getByIdentifier({ identifier: task.identifier.toLowerCase() })).id,
      ).toBe(task.id);
      await expect(
        ada.client.tasks.getByIdentifier({ identifier: 'TF-999999' }),
      ).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });

    test('deleted tasks disappear', async () => {
      const task = await create('Delete me');
      await ada.client.tasks.delete({ id: task.id, version: task.version });
      await expect(ada.client.tasks.get({ id: task.id })).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
      const all = await ada.client.tasks.list({ projectId: project.id });
      expect(all.map((t) => t.id)).not.toContain(task.id);
    });
  });

  describe('permissions and isolation', () => {
    test('guests read tasks but cannot change them', async () => {
      const guest = await h.join(ada, 'Guest', 'guest');
      const task = await create('Guarded');
      expect((await guest.client.tasks.get({ id: task.id })).title).toBe('Guarded');
      await expect(
        guest.client.tasks.update({ id: task.id, version: task.version, title: 'nope' }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
      await expect(
        guest.client.tasks.create({ projectId: project.id, title: 'nope' }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });

    test('other organizations cannot see, list, move or delete', async () => {
      const task = await create('Private');
      const mallory = await h.owner('Mallory');
      await expect(mallory.client.tasks.get({ id: task.id })).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
      await expect(mallory.client.tasks.list({ projectId: project.id })).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
      await expect(
        mallory.client.tasks.getByIdentifier({ identifier: task.identifier }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
      await expect(
        mallory.client.tasks.move({ id: task.id, version: 1, statusId: task.statusId }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
      await expect(mallory.client.tasks.delete({ id: task.id, version: 1 })).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
      await expect(mallory.client.tasks.history({ id: task.id })).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });
  });
});
