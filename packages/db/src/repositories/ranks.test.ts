import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { REBALANCE_THRESHOLD } from '@teamflow/domain';
import { and, asc, eq, sql } from 'drizzle-orm';
import { newId } from '../ids.ts';
import { members, organizations, users } from '../schema/auth.ts';
import { outbox, tasks } from '../schema/tasks.ts';
import { createScope, type Scope } from '../scope.ts';
import { createTestDatabase, type TestDatabase } from '../testing.ts';
import { createProject } from './projects.ts';
import { rebalanceCandidates, rebalanceColumn } from './ranks.ts';
import { createTask, deleteTask, moveTask } from './tasks.ts';

const now = new Date(Date.UTC(2026, 2, 2, 9));

describe('rank rebalancing', () => {
  let t: TestDatabase;
  let scope: Scope;
  let projectId: string;
  let todo: string;

  const column = (statusId: string) =>
    t.db
      .select({
        id: tasks.id,
        rank: tasks.rank,
        version: tasks.version,
        deletedAt: tasks.deletedAt,
      })
      .from(tasks)
      .where(and(eq(tasks.organizationId, scope.organizationId), eq(tasks.statusId, statusId)))
      .orderBy(asc(tasks.rank));

  beforeAll(async () => {
    t = await createTestDatabase();
    const organizationId = newId();
    const memberId = newId();
    const userId = newId();
    await t.db.insert(users).values({ id: userId, name: 'Ada', email: 'ada@example.com' });
    await t.db.insert(organizations).values({ id: organizationId, name: 'Org', slug: 'org' });
    await t.db.insert(members).values({ id: memberId, organizationId, userId, role: 'owner' });
    scope = createScope(t.db, organizationId, memberId);
    const created = await createProject(scope, { key: 'RB', name: 'Ranks' });
    projectId = created.project.id;
    todo = created.statuses.find((s) => s.name === 'Todo')?.id ?? '';
  });
  afterAll(() => t.destroy());

  test('a column with an overlong key gets short keys in the same order', async () => {
    const created = [];
    for (const title of ['A', 'B', 'C', 'D']) {
      const task = await createTask(scope, { projectId, title, statusId: todo }, now);
      if (task) created.push(task);
    }
    // Simulate many inserts into one gap: C's key grows past the threshold but stays between B and D.
    const before = await column(todo);
    const long = `${before[2]?.rank}${'V'.repeat(REBALANCE_THRESHOLD)}`;
    await t.db
      .update(tasks)
      .set({ rank: long })
      .where(eq(tasks.id, before[2]?.id ?? ''));
    const order = (await column(todo)).map((r) => r.id);

    // Deleted tasks keep a place too, so a restore lands where it was.
    const deleted = created[0];
    if (!deleted) throw new Error('no task');
    await deleteTask(scope, deleted.id, deleted.version, now);

    expect(await rebalanceCandidates(t.db)).toEqual([
      { organizationId: scope.organizationId, statusId: todo },
    ]);
    const versions = new Map((await column(todo)).map((r) => [r.id, r.version]));
    expect(await rebalanceColumn(createScope(t.db, scope.organizationId, null), todo)).toBe(4);

    const after = await column(todo);
    expect(after.map((r) => r.id)).toEqual(order);
    expect(Math.max(...after.map((r) => r.rank.length))).toBeLessThanOrEqual(3);
    for (const row of after) expect(row.version).toBe((versions.get(row.id) ?? 0) + 1);
    expect(await rebalanceCandidates(t.db)).toEqual([]);

    const [event] = await t.db
      .select({ topic: outbox.topic, payload: outbox.payload })
      .from(outbox)
      .where(eq(outbox.topic, 'tasks.reordered'));
    expect(event?.payload).toEqual({ projectId, statusId: todo });
  });

  test('an already balanced column is left alone', async () => {
    const quiet = createScope(t.db, scope.organizationId, null);
    expect(await rebalanceColumn(quiet, todo)).toBe(0);
  });

  test('moves keep working against the new keys', async () => {
    const [first, second] = (await column(todo)).filter((r) => r.deletedAt === null);
    if (!first || !second) throw new Error('no tasks');
    const moved = await moveTask(
      scope,
      second.id,
      second.version,
      { statusId: todo, afterId: null, beforeId: first.id },
      now,
    );
    expect(moved?.rank && moved.rank < first.rank).toBe(true);
  });

  test('a rebalance waits for a move that is computing a key in that column', async () => {
    const order: string[] = [];
    let release = () => {};
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    // Hold the shared column lock in an open transaction, the way a move does while it computes a key.
    const moving = t.db.transaction(async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock_shared(hashtextextended(${todo}::text, 0))`,
      );
      await held;
      order.push('move');
    });
    const rebalance = rebalanceColumn(createScope(t.db, scope.organizationId, null), todo).then(
      () => order.push('rebalance'),
    );
    // Wait until the rebalance is queued behind the lock.
    for (;;) {
      const [waiting] = await t.db.execute(
        sql`select 1 from pg_locks where locktype = 'advisory' and not granted`,
      );
      if (waiting) break;
    }
    expect(order).toEqual([]);
    release();
    await Promise.all([moving, rebalance]);
    expect(order).toEqual(['move', 'rebalance']);
  });

  test('a move waits for a rebalance running in its column', async () => {
    const first = (await column(todo)).find((r) => r.deletedAt === null);
    if (!first) throw new Error('no task');
    const order: string[] = [];
    let release = () => {};
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    const rebalancing = t.db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${todo}::text, 0))`);
      await held;
      order.push('rebalance');
    });
    const move = moveTask(scope, first.id, first.version, { statusId: todo }, now).then(() =>
      order.push('move'),
    );
    for (;;) {
      const [waiting] = await t.db.execute(
        sql`select 1 from pg_locks where locktype = 'advisory' and not granted`,
      );
      if (waiting) break;
    }
    expect(order).toEqual([]);
    release();
    await Promise.all([rebalancing, move]);
    expect(order).toEqual(['rebalance', 'move']);
  });
});
