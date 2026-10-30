import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { eq } from 'drizzle-orm';
import { newId } from '../ids.ts';
import { members, organizations, users } from '../schema/auth.ts';
import { notifications } from '../schema/collaboration.ts';
import { outbox } from '../schema/tasks.ts';
import { createScope, inTransaction, type Scope } from '../scope.ts';
import { createTestDatabase, type TestDatabase } from '../testing.ts';
import { ANNOUNCE_BATCH, notify } from './collaboration.ts';
import { MAX_NOTIFY_BYTES, relayOutbox } from './outbox.ts';
import { createProject } from './projects.ts';
import { createTask } from './tasks.ts';

describe('notification announcements', () => {
  let t: TestDatabase;
  let scope: Scope;
  const organizationId = newId();
  const people: string[] = [];

  beforeAll(async () => {
    t = await createTestDatabase();
    await t.db.insert(organizations).values({ id: organizationId, name: 'Org', slug: 'org' });
    for (let i = 0; i < 251; i++) {
      const userId = newId();
      const memberId = newId();
      await t.db.insert(users).values({ id: userId, name: `P${i}`, email: `p${i}@example.com` });
      await t.db.insert(members).values({ id: memberId, organizationId, userId, role: 'member' });
      people.push(memberId);
    }
    scope = createScope(t.db, organizationId, people[0] ?? null);
  });
  afterAll(() => t.destroy());

  test('a crowd of recipients is announced in batches that each fit a NOTIFY', async () => {
    const { project } = await createProject(scope, { key: 'NT', name: 'Notify' });
    const task = await createTask(scope, { projectId: project.id, title: 'Busy' }, new Date());
    if (!task) throw new Error('no task');
    await t.db.delete(outbox);

    await inTransaction(scope, (tx) =>
      notify(tx, people, 'commented', { taskId: task.id, data: { title: 'Busy' } }),
    );

    expect(
      await t.db.select().from(notifications).where(eq(notifications.taskId, task.id)),
    ).toHaveLength(250);
    const events = await t.db
      .select()
      .from(outbox)
      .where(eq(outbox.topic, 'notifications.created'));
    expect(events).toHaveLength(Math.ceil(250 / ANNOUNCE_BATCH));
    const announced = events.flatMap((e) => e.payload.recipientMemberIds as string[]);
    expect(new Set(announced)).toEqual(new Set(people.slice(1)));
    for (const event of events) {
      expect(Buffer.byteLength(JSON.stringify(event))).toBeLessThan(MAX_NOTIFY_BYTES);
    }

    const skipped: string[] = [];
    await relayOutbox(t.db, { channel: 'notify_test', onOversized: (id) => skipped.push(id) });
    expect(skipped).toEqual([]);
  });
});
