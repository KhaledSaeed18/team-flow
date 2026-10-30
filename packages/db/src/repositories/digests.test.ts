import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { newId } from '../ids.ts';
import { members, organizations, users } from '../schema/auth.ts';
import { notifications } from '../schema/collaboration.ts';
import { createScope } from '../scope.ts';
import { createTestDatabase, type TestDatabase } from '../testing.ts';
import { digestCandidates, digestItems, markDigestSent } from './digests.ts';
import { createProject } from './projects.ts';
import { createTask } from './tasks.ts';

const at = (hour: number) => new Date(Date.UTC(2026, 2, 2, hour));

describe('digests', () => {
  let t: TestDatabase;
  const organizationId = newId();
  const reader = newId();
  const writer = newId();
  let taskId: string;

  beforeAll(async () => {
    t = await createTestDatabase();
    await t.db.insert(organizations).values({ id: organizationId, name: 'Org', slug: 'org' });
    for (const [memberId, name] of [
      [reader, 'Reader'],
      [writer, 'Writer'],
    ] as const) {
      const userId = newId();
      await t.db.insert(users).values({ id: userId, name, email: `${name}@example.com` });
      await t.db.insert(members).values({ id: memberId, organizationId, userId, role: 'member' });
    }
    const scope = createScope(t.db, organizationId, writer);
    const { project } = await createProject(scope, { key: 'DG', name: 'Digest' });
    const task = await createTask(scope, { projectId: project.id, title: 'T' }, at(0));
    if (!task) throw new Error('no task');
    taskId = task.id;
  });
  afterAll(() => t.destroy());

  const notifyAt = (hour: number) =>
    t.db.insert(notifications).values({
      organizationId,
      recipientMemberId: reader,
      actorMemberId: writer,
      kind: 'commented',
      taskId,
      data: { title: `At ${hour}` },
      createdAt: at(hour),
    });

  test('an item is in exactly one digest, even if it arrives while a digest is being sent', async () => {
    await notifyAt(9);
    // The pass runs "at 10:00" but this item lands while it is still going: it belongs to the next digest.
    await notifyAt(11);

    const first = await digestItems(t.db, organizationId, reader, at(0), at(10));
    expect(first.map((i) => i.data.title)).toEqual(['At 9']);
    await markDigestSent(t.db, organizationId, reader, at(10));

    const second = await digestItems(t.db, organizationId, reader, at(10), at(12));
    expect(second.map((i) => i.data.title)).toEqual(['At 11']);
  });

  test('nobody is a candidate for items newer than the pass', async () => {
    const candidates = await digestCandidates(t.db, at(10));
    expect(candidates.some((c) => c.memberId === reader)).toBe(false);
  });
});
