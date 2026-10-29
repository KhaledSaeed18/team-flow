import { describe, expect, test } from 'bun:test';
import { burndown, cycleTimes, median, stateAt, type TaskChange, velocity } from './metrics.ts';

const S = 'sprint-1';
const day = (n: number, hour = 12) => new Date(Date.UTC(2026, 2, 2 + n, hour));
const start = day(0, 0);
const end = day(5, 0);

const created = (
  taskId: string,
  at: Date,
  estimate: number | null,
  sprintId: string | null = S,
): TaskChange[] => [
  { taskId, at, field: 'status', to: { id: 'todo', category: 'unstarted' } },
  { taskId, at, field: 'sprintId', to: sprintId },
  { taskId, at, field: 'estimate', to: estimate },
];
const status = (taskId: string, at: Date, category: string): TaskChange => ({
  taskId,
  at,
  field: 'status',
  to: { id: category, category },
});

describe('stateAt', () => {
  test('replays changes up to an instant', () => {
    const changes = [...created('a', day(-1), 3), status('a', day(1), 'completed')];
    expect(stateAt(changes, day(0)).get('a')).toMatchObject({ category: 'unstarted', estimate: 3 });
    expect(stateAt(changes, day(2)).get('a')).toMatchObject({ category: 'completed' });
  });
});

describe('burndown', () => {
  const base = [
    ...created('a', day(-1), 3),
    ...created('b', day(-1), 5),
    ...created('c', day(-1), 2),
    ...created('outside', day(-1), 8, null),
  ];

  test('committed scope is what was in the sprint at its start', () => {
    const result = burndown(S, base, { startsAt: start, endsAt: end, now: end });
    expect(result.committed).toEqual({
      remainingTasks: 3,
      remainingPoints: 10,
      totalTasks: 3,
      totalPoints: 10,
    });
  });

  test('remaining work falls as tasks complete, one point per day', () => {
    const changes = [...base, status('a', day(1), 'completed'), status('b', day(3), 'completed')];
    const result = burndown(S, changes, { startsAt: start, endsAt: end, now: end });
    expect(result.days.map((d) => d.remainingPoints)).toEqual([10, 7, 7, 2, 2]);
    expect(result.days.map((d) => d.idealPoints)).toEqual([8, 6, 4, 2, 0]);
  });

  test('reopened work comes back', () => {
    const changes = [...base, status('a', day(1), 'completed'), status('a', day(2), 'started')];
    const result = burndown(S, changes, { startsAt: start, endsAt: end, now: end });
    expect(result.days.map((d) => d.remainingPoints)).toEqual([10, 7, 10, 10, 10]);
  });

  test('scope added and removed after the start is tracked separately', () => {
    const changes = [
      ...base,
      ...created('late', day(1), 4),
      { taskId: 'c', at: day(2), field: 'sprintId', to: null } as TaskChange,
      { taskId: 'b', at: day(2), field: 'estimate', to: 8 } as TaskChange,
      status('a', day(3), 'canceled'),
      status('b', day(4), 'completed'),
    ];
    const result = burndown(S, changes, { startsAt: start, endsAt: end, now: end });
    expect(result.scopeAdded).toBe(4 + 3);
    expect(result.scopeRemoved).toBe(2 + 3);
    expect(result.days.at(-1)).toMatchObject({ totalPoints: 12, remainingPoints: 4 });
  });

  test('a sprint in progress stops at today', () => {
    const result = burndown(S, base, { startsAt: start, endsAt: end, now: day(2) });
    expect(result.days).toHaveLength(3);
  });

  test('deleted tasks leave the sprint', () => {
    const changes = [
      ...base,
      { taskId: 'b', at: day(1), field: 'deleted', to: true } as TaskChange,
    ];
    const result = burndown(S, changes, { startsAt: start, endsAt: end, now: end });
    expect(result.days.at(-1)?.remainingPoints).toBe(5);
  });
});

describe('velocity and cycle time', () => {
  test('velocity averages the most recent sprints', () => {
    const outcomes = [10, 20, 30, 40].map((completedPoints, i) => ({
      sprintId: String(i),
      committedPoints: 30,
      completedPoints,
    }));
    expect(velocity(outcomes)).toBe(30);
    expect(velocity([])).toBe(0);
  });

  test('median', () => {
    expect(median([])).toBeNull();
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });

  test('cycle times count only work completed in the window', () => {
    const hour = 3_600_000;
    const tasks = [
      { startedAt: day(0), completedAt: new Date(day(0).getTime() + 5 * hour) },
      { startedAt: day(-3), completedAt: day(1) },
      { startedAt: null, completedAt: day(1) },
      { startedAt: day(0), completedAt: null },
      { startedAt: day(-10), completedAt: day(-8) },
    ];
    expect(cycleTimes(tasks, day(0, 0), day(5, 0))).toEqual([5 * hour, 4 * 86_400_000]);
  });
});
