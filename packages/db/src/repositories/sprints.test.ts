import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { newId } from '../ids.ts';
import { members, organizations, users } from '../schema/auth.ts';
import { createScope, type Scope } from '../scope.ts';
import { createTestDatabase, type TestDatabase } from '../testing.ts';
import { createProject } from './projects.ts';
import {
  completedSprints,
  completeSprint,
  createSprint,
  SprintStateError,
  sprintChanges,
  startSprint,
} from './sprints.ts';
import { createTask, findTask, InvalidReferenceError, moveTask, updateTask } from './tasks.ts';

const day = (n: number) => new Date(Date.UTC(2026, 2, 2 + n, 9));

describe('sprints', () => {
  let t: TestDatabase;
  let scope: Scope;
  let projectId: string;
  let statuses: { name: string; id: string }[];
  const status = (name: string) => statuses.find((s) => s.name === name)?.id ?? '';

  beforeAll(async () => {
    t = await createTestDatabase();
    const organizationId = newId();
    const memberId = newId();
    const userId = newId();
    await t.db.insert(users).values({ id: userId, name: 'Ada', email: 'ada@example.com' });
    await t.db.insert(organizations).values({ id: organizationId, name: 'Org', slug: 'org' });
    await t.db.insert(members).values({ id: memberId, organizationId, userId, role: 'owner' });
    scope = createScope(t.db, organizationId, memberId);
    const created = await createProject(scope, { key: 'SP', name: 'Sprints' });
    projectId = created.project.id;
    statuses = created.statuses;
  });
  afterAll(() => t.destroy());

  test('only one sprint per project can be active', async () => {
    const a = await createSprint(scope, {
      projectId,
      name: 'A',
      startsAt: day(0),
      endsAt: day(14),
    });
    const b = await createSprint(scope, {
      projectId,
      name: 'B',
      startsAt: day(14),
      endsAt: day(28),
    });
    await startSprint(scope, a.id, a.version, day(0));
    await expect(startSprint(scope, b.id, b.version, day(0))).rejects.toMatchObject({
      cause: { constraint_name: 'sprints_one_active_per_project' },
    });
    await expect(startSprint(scope, a.id, a.version + 1, day(0))).rejects.toBeInstanceOf(
      SprintStateError,
    );
  });

  test('a sprint must end after it starts', async () => {
    await expect(
      createSprint(scope, { projectId, name: 'Backwards', startsAt: day(5), endsAt: day(1) }),
    ).rejects.toMatchObject({ cause: { constraint_name: 'sprints_dates' } });
  });

  test('completing freezes the points and carries unfinished work over', async () => {
    const project = await createProject(scope, { key: 'CO', name: 'Carry over' });
    const done = project.statuses.find((s) => s.name === 'Done')?.id ?? '';
    const sprint = await createSprint(scope, {
      projectId: project.project.id,
      name: 'Sprint 1',
      startsAt: day(0),
      endsAt: day(10),
    });
    const next = await createSprint(scope, {
      projectId: project.project.id,
      name: 'Sprint 2',
      startsAt: day(10),
      endsAt: day(20),
    });

    const finished = await createTask(
      scope,
      { projectId: project.project.id, title: 'Finished', estimate: 5, sprintId: sprint.id },
      day(-1),
    );
    const unfinished = await createTask(
      scope,
      { projectId: project.project.id, title: 'Unfinished', estimate: 3, sprintId: sprint.id },
      day(-1),
    );
    const started = await startSprint(scope, sprint.id, sprint.version, day(0));
    if (!finished || !unfinished || !started) throw new Error('setup failed');

    await moveTask(scope, finished.id, finished.version, { statusId: done }, day(3));
    const late = await createTask(
      scope,
      { projectId: project.project.id, title: 'Late', estimate: 2 },
      day(4),
    );
    if (!late) throw new Error('setup failed');
    await updateTask(scope, late.id, late.version, { sprintId: sprint.id }, day(4));

    const completed = await completeSprint(scope, sprint.id, started.version, next.id, day(10));
    await expect(completed).toMatchObject({
      status: 'completed',
      committedPoints: 8,
      completedPoints: 5,
    });

    await expect((await findTask(scope, unfinished.id))?.sprintId).toBe(next.id);
    await expect((await findTask(scope, late.id))?.sprintId).toBe(next.id);
    await expect((await findTask(scope, finished.id))?.sprintId).toBe(sprint.id);
    await expect((await completedSprints(scope, project.project.id)).map((s) => s.name)).toEqual([
      'Sprint 1',
    ]);

    const changes = await sprintChanges(scope, sprint.id);
    await expect(new Set(changes.map((c) => c.taskId))).toEqual(
      new Set([finished.id, unfinished.id, late.id]),
    );
  });

  test('carry-over only goes to a planned sprint of the same project', async () => {
    const mine = await createProject(scope, { key: 'MINE', name: 'Mine' });
    const other = await createProject(scope, { key: 'OTH', name: 'Other' });
    const foreign = await createSprint(scope, {
      projectId: other.project.id,
      name: 'Foreign',
      startsAt: day(0),
      endsAt: day(5),
    });
    const sprint = await createSprint(scope, {
      projectId: mine.project.id,
      name: 'Guarded',
      startsAt: day(0),
      endsAt: day(5),
    });
    const active = await startSprint(scope, sprint.id, sprint.version, day(0));
    if (!active) throw new Error('setup failed');
    await expect(
      completeSprint(scope, active.id, active.version, foreign.id, day(5)),
    ).rejects.toBeInstanceOf(InvalidReferenceError);
  });

  test("a task's sprint must belong to the task's project", async () => {
    const other = await createProject(scope, { key: 'XS', name: 'Cross' });
    const foreign = await createSprint(scope, {
      projectId: other.project.id,
      name: 'Elsewhere',
      startsAt: day(0),
      endsAt: day(5),
    });
    await expect(
      createTask(
        scope,
        { projectId, title: 'Wrong sprint', sprintId: foreign.id, statusId: status('Todo') },
        day(0),
      ),
    ).rejects.toMatchObject({ cause: { constraint_name: 'tasks_sprint_in_project_fk' } });
  });
});
