import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { eq } from 'drizzle-orm';
import { newId } from './ids.ts';
import { members, organizations, users } from './schema/auth.ts';
import { projects, workflowStatuses } from './schema/projects.ts';
import { tasks } from './schema/tasks.ts';
import { createTestDatabase, type TestDatabase } from './testing.ts';

/** What the database itself refuses, independent of any application code. */
describe('database constraints', () => {
  let t: TestDatabase;
  const orgA = newId();
  const orgB = newId();
  const memberA = newId();
  const memberB = newId();
  const projectA = newId();
  const statusA = newId();

  beforeAll(async () => {
    t = await createTestDatabase();
    const [ua, ub] = [newId(), newId()];
    await t.db.insert(users).values([
      { id: ua, name: 'A', email: 'a@example.com' },
      { id: ub, name: 'B', email: 'b@example.com' },
    ]);
    await t.db.insert(organizations).values([
      { id: orgA, name: 'A', slug: 'a' },
      { id: orgB, name: 'B', slug: 'b' },
    ]);
    await t.db.insert(members).values([
      { id: memberA, organizationId: orgA, userId: ua, role: 'owner' },
      { id: memberB, organizationId: orgB, userId: ub, role: 'owner' },
    ]);
    await t.db
      .insert(projects)
      .values({ id: projectA, organizationId: orgA, key: 'TF', name: 'TeamFlow' });
    await t.db.insert(workflowStatuses).values({
      id: statusA,
      organizationId: orgA,
      projectId: projectA,
      name: 'Todo',
      category: 'unstarted',
      color: '#000',
      rank: 'a0',
    });
  });

  afterAll(() => t.destroy());

  /** Await a query and expect Postgres to refuse it with a constraint violation. */
  const refused = (query: PromiseLike<unknown>, constraint: RegExp) =>
    expect(Promise.resolve(query)).rejects.toMatchObject({
      cause: { constraint_name: expect.stringMatching(constraint) },
    });

  const task = (overrides: Partial<typeof tasks.$inferInsert> = {}) => ({
    organizationId: orgA,
    projectId: projectA,
    number: Math.floor(Math.random() * 1e9),
    title: 'A task',
    statusId: statusA,
    rank: 'a0',
    ...overrides,
  });

  test('a row cannot reference a project in another organization', async () => {
    await refused(t.db.insert(tasks).values(task({ organizationId: orgB })), /project_id_projects/);
  });

  test('a task cannot be assigned to a member of another organization', async () => {
    await refused(
      t.db.insert(tasks).values(task({ assigneeMemberId: memberB })),
      /assignee_member_id/,
    );
  });

  test('removing a member unassigns their tasks without touching organization_id', async () => {
    const [ua] = await t.db
      .insert(users)
      .values({ name: 'Temp', email: 'temp@example.com' })
      .returning();
    const [m] = await t.db
      .insert(members)
      .values({ organizationId: orgA, userId: ua?.id ?? '', role: 'member' })
      .returning();
    const [created] = await t.db
      .insert(tasks)
      .values(task({ assigneeMemberId: m?.id ?? null }))
      .returning();

    await t.db.delete(members).where(eq(members.id, m?.id ?? ''));

    const [after] = await t.db
      .select()
      .from(tasks)
      .where(eq(tasks.id, created?.id ?? ''));
    expect(after?.assigneeMemberId).toBeNull();
    expect(after?.organizationId).toBe(orgA);
  });

  test('project keys are validated and unique per organization', async () => {
    await refused(
      t.db.insert(projects).values({ organizationId: orgA, key: 'bad', name: 'x' }),
      /projects_key_format/,
    );
    await refused(
      t.db.insert(projects).values({ organizationId: orgA, key: 'TF', name: 'Duplicate' }),
      /key/,
    );
    await t.db
      .insert(projects)
      .values({ organizationId: orgB, key: 'TF', name: 'Same key elsewhere' });
  });

  test('ranks sort by bytes, not by locale', async () => {
    // Under a natural-language collation "a0a" sorts before "a0Z"; fractional keys need "Z" (0x5A) first.
    for (const rank of ['a0a', 'a0Z', 'a0V']) {
      await t.db.insert(tasks).values(task({ rank, title: `rank ${rank}` }));
    }
    const rows = await t.db
      .select({ rank: tasks.rank })
      .from(tasks)
      .where(eq(tasks.projectId, projectA))
      .orderBy(tasks.rank);
    const sample = rows.map((r) => r.rank).filter((r) => r.startsWith('a0') && r.length === 3);
    expect(sample).toEqual(['a0V', 'a0Z', 'a0a']);
  });
});
