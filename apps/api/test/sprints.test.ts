import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import type { Outputs } from '@teamflow/contract';
import { createHarness, type Harness } from './harness.ts';

type Project = Outputs['projects']['create'];
type Owner = Awaited<ReturnType<Harness['owner']>>;

const DAY = 86_400_000;

describe('sprints', () => {
  let h: Harness;
  let ada: Owner;
  let project: Project;
  const status = (name: string) => project.statuses.find((s) => s.name === name)?.id ?? '';

  beforeAll(async () => {
    h = await createHarness();
    ada = await h.owner('Ada');
    project = await ada.client.projects.create({ key: 'SPR', name: 'Sprints' });
  });
  afterAll(() => h.destroy());

  test('a sprint played out day by day produces its burndown, velocity and cycle time', async () => {
    const start = h.clock.now();
    const sprint = await ada.client.sprints.create({
      projectId: project.id,
      name: 'Sprint 1',
      goal: 'Ship the board',
      startsAt: start,
      endsAt: new Date(start.getTime() + 5 * DAY),
    });
    const next = await ada.client.sprints.create({
      projectId: project.id,
      name: 'Sprint 2',
      startsAt: new Date(start.getTime() + 5 * DAY),
      endsAt: new Date(start.getTime() + 10 * DAY),
    });

    const [a, b, c] = await Promise.all(
      [3, 5, 2].map((estimate, i) =>
        ada.client.tasks.create({
          projectId: project.id,
          title: `Task ${i}`,
          estimate,
          sprintId: sprint.id,
        }),
      ),
    );
    if (!a || !b || !c) throw new Error('setup failed');
    const started = await ada.client.sprints.start({ id: sprint.id, version: sprint.version });
    expect(started.status).toBe('active');

    // Day 1: A starts and finishes. Day 3: B finishes. C never does.
    h.clock.advance(DAY / 2);
    const aStarted = await ada.client.tasks.move({
      id: a.id,
      version: a.version,
      statusId: status('In Progress'),
    });
    h.clock.advance(DAY / 4);
    await ada.client.tasks.move({ id: a.id, version: aStarted.version, statusId: status('Done') });
    h.clock.advance(2 * DAY);
    await ada.client.tasks.move({ id: b.id, version: b.version, statusId: status('Done') });

    const midway = await ada.client.sprints.report({ id: sprint.id });
    expect(midway.committed).toMatchObject({ totalPoints: 10, totalTasks: 3 });
    expect(midway.days.map((d) => d.remainingPoints)).toEqual([7, 7, 2]);

    h.clock.advance(2.25 * DAY);
    const completed = await ada.client.sprints.complete({
      id: sprint.id,
      version: started.version,
      carryOverTo: next.id,
    });
    expect(completed).toMatchObject({
      status: 'completed',
      committedPoints: 10,
      completedPoints: 8,
    });
    expect((await ada.client.tasks.get({ id: c.id })).sprintId).toBe(next.id);

    const report = await ada.client.sprints.report({ id: sprint.id });
    expect(report.velocity).toBe(8);
    expect(report.history).toEqual([
      { sprintId: sprint.id, name: 'Sprint 1', committedPoints: 10, completedPoints: 8 },
    ]);
    // A: 0.25 days from start to done. B jumped straight to Done, so its cycle time is zero.
    expect(report.medianCycleTimeHours).toBe(3);
  });

  test('the backlog is the work in no sprint', async () => {
    const sprint = await ada.client.sprints.create({
      projectId: project.id,
      name: 'Filtering',
      startsAt: h.clock.now(),
      endsAt: new Date(h.clock.now().getTime() + DAY),
    });
    const inSprint = await ada.client.tasks.create({
      projectId: project.id,
      title: 'Planned',
      sprintId: sprint.id,
    });
    const backlog = await ada.client.tasks.create({ projectId: project.id, title: 'Someday' });

    const sprintIds = (
      await ada.client.tasks.list({ projectId: project.id, sprintId: sprint.id })
    ).map((t) => t.id);
    const backlogIds = (await ada.client.tasks.list({ projectId: project.id, sprintId: null })).map(
      (t) => t.id,
    );
    expect(sprintIds).toEqual([inSprint.id]);
    expect(backlogIds).toContain(backlog.id);
    expect(backlogIds).not.toContain(inSprint.id);
  });

  test('only one active sprint, and only the active one completes', async () => {
    const p = await ada.client.projects.create({ key: 'ONE', name: 'One active' });
    const make = (name: string) =>
      ada.client.sprints.create({
        projectId: p.id,
        name,
        startsAt: h.clock.now(),
        endsAt: new Date(h.clock.now().getTime() + DAY),
      });
    const first = await make('First');
    const second = await make('Second');
    await ada.client.sprints.start({ id: first.id, version: first.version });
    await expect(
      ada.client.sprints.start({ id: second.id, version: second.version }),
    ).rejects.toMatchObject({
      code: 'SPRINT_STATE',
    });
    await expect(
      ada.client.sprints.complete({ id: second.id, version: second.version, carryOverTo: null }),
    ).rejects.toMatchObject({ code: 'SPRINT_STATE' });
  });

  test('dates are validated before anything is written', async () => {
    await expect(
      ada.client.sprints.create({
        projectId: project.id,
        name: 'Backwards',
        startsAt: h.clock.now(),
        endsAt: new Date(h.clock.now().getTime() - DAY),
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  test('guests cannot plan; other organizations cannot see', async () => {
    const guest = await h.join(ada, 'Guest', 'guest');
    await expect(
      guest.client.sprints.create({
        projectId: project.id,
        name: 'Nope',
        startsAt: h.clock.now(),
        endsAt: new Date(h.clock.now().getTime() + DAY),
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect((await guest.client.sprints.list({ projectId: project.id })).length).toBeGreaterThan(0);

    const mallory = await h.owner('Mallory');
    await expect(mallory.client.sprints.list({ projectId: project.id })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    const [any] = await ada.client.sprints.list({ projectId: project.id });
    await expect(mallory.client.sprints.report({ id: any?.id ?? '' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});
