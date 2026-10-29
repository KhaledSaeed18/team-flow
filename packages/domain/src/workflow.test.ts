import { describe, expect, test } from 'bun:test';
import { canRemoveStatus, DEFAULT_WORKFLOW, nextLifecycle, validateWorkflow } from './workflow.ts';

const t0 = new Date('2026-01-01T09:00:00Z');
const t1 = new Date('2026-01-02T09:00:00Z');
const empty = { startedAt: null, completedAt: null, canceledAt: null };

describe('validateWorkflow', () => {
  test('the default workflow is valid', () => {
    const statuses = DEFAULT_WORKFLOW.map((s, i) => ({ id: String(i), category: s.category }));
    expect(validateWorkflow(statuses)).toEqual([]);
  });

  test('requires an unstarted and a completed status', () => {
    expect(validateWorkflow([{ id: '1', category: 'started' }])).toEqual([
      { code: 'missing_category', category: 'unstarted' },
      { code: 'missing_category', category: 'completed' },
    ]);
  });

  test('a status can be removed unless it is the last of a required category', () => {
    const statuses = [
      { id: 'todo', category: 'unstarted' as const },
      { id: 'doing', category: 'started' as const },
      { id: 'done', category: 'completed' as const },
    ];
    expect(canRemoveStatus(statuses, 'doing')).toBe(true);
    expect(canRemoveStatus(statuses, 'done')).toBe(false);
    expect(canRemoveStatus(statuses, 'todo')).toBe(false);
  });
});

describe('nextLifecycle', () => {
  test('starting work stamps startedAt once', () => {
    const started = nextLifecycle(empty, 'started', t0);
    expect(started.startedAt).toEqual(t0);
    expect(nextLifecycle(started, 'started', t1).startedAt).toEqual(t0);
  });

  test('completing keeps the first start and stamps completion', () => {
    const done = nextLifecycle(nextLifecycle(empty, 'started', t0), 'completed', t1);
    expect(done).toEqual({ startedAt: t0, completedAt: t1, canceledAt: null });
  });

  test('completing without starting counts as starting at completion', () => {
    expect(nextLifecycle(empty, 'completed', t1).startedAt).toEqual(t1);
  });

  test('reopening clears completion but keeps the start', () => {
    const done = nextLifecycle(nextLifecycle(empty, 'started', t0), 'completed', t1);
    expect(nextLifecycle(done, 'started', t1)).toEqual({
      startedAt: t0,
      completedAt: null,
      canceledAt: null,
    });
  });

  test('moving back to unstarted resets everything', () => {
    const started = nextLifecycle(empty, 'started', t0);
    expect(nextLifecycle(started, 'unstarted', t1)).toEqual(empty);
    expect(nextLifecycle(started, 'backlog', t1)).toEqual(empty);
  });

  test('canceling records the cancel and does not invent a start', () => {
    expect(nextLifecycle(empty, 'canceled', t1)).toEqual({
      startedAt: null,
      completedAt: null,
      canceledAt: t1,
    });
  });
});
