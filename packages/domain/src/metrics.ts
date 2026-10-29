import { isClosed, type StatusCategory } from './workflow.ts';

/**
 * Sprint metrics, computed by replaying the activity log (ADR-0007) rather than from stored snapshots.
 *
 * Every task's history starts with its creation, which records the initial status, sprint and estimate; every
 * later change to those fields is a `FieldChange`. Replaying a task's changes up to an instant gives its state
 * at that instant, which is all a burndown needs.
 */

export interface TaskChange {
  taskId: string;
  at: Date;
  field: 'status' | 'sprintId' | 'estimate' | 'deleted';
  /** For `status`: `{ id, category }`. For `sprintId`: id or null. For `estimate`: number or null. */
  to: unknown;
}

interface TaskState {
  category: StatusCategory | null;
  sprintId: string | null;
  estimate: number | null;
  deleted: boolean;
}

const EMPTY: TaskState = { category: null, sprintId: null, estimate: null, deleted: false };

function apply(state: TaskState, change: TaskChange): TaskState {
  switch (change.field) {
    case 'status':
      return {
        ...state,
        category: (change.to as { category?: StatusCategory } | null)?.category ?? null,
      };
    case 'sprintId':
      return { ...state, sprintId: typeof change.to === 'string' ? change.to : null };
    case 'estimate':
      return { ...state, estimate: typeof change.to === 'number' ? change.to : null };
    case 'deleted':
      return { ...state, deleted: true };
  }
}

/** Every task's state at `instant`, from changes sorted by time. */
export function stateAt(changes: readonly TaskChange[], instant: Date): Map<string, TaskState> {
  const states = new Map<string, TaskState>();
  for (const change of changes) {
    if (change.at > instant) break;
    states.set(change.taskId, apply(states.get(change.taskId) ?? EMPTY, change));
  }
  return states;
}

const byTime = (a: TaskChange, b: TaskChange) => a.at.getTime() - b.at.getTime();

export interface Totals {
  /** Tasks in the sprint that are not closed. */
  remainingTasks: number;
  /** Their estimates summed; unestimated tasks count as zero points. */
  remainingPoints: number;
  totalTasks: number;
  totalPoints: number;
}

function totals(states: Map<string, TaskState>, sprintId: string): Totals {
  const result: Totals = { remainingTasks: 0, remainingPoints: 0, totalTasks: 0, totalPoints: 0 };
  for (const state of states.values()) {
    if (state.deleted || state.sprintId !== sprintId) continue;
    // Canceled work leaves the sprint's scope rather than counting as done.
    if (state.category === 'canceled') continue;
    const points = state.estimate ?? 0;
    result.totalTasks++;
    result.totalPoints += points;
    if (!state.category || !isClosed(state.category)) {
      result.remainingTasks++;
      result.remainingPoints += points;
    }
  }
  return result;
}

export interface BurndownPoint extends Totals {
  /** End of the day (exclusive bound), UTC. */
  at: Date;
  /** What a straight line from the committed scope to zero says should remain. */
  idealPoints: number;
}

export interface Burndown {
  /** Scope when the sprint started. */
  committed: Totals;
  /** One point per day, up to the end of the sprint or `now`, whichever is earlier. */
  days: BurndownPoint[];
  /** Points added to and removed from the sprint after it started. */
  scopeAdded: number;
  scopeRemoved: number;
}

const DAY = 86_400_000;

/** Burndown for a sprint from `startsAt` to `endsAt`. */
export function burndown(
  sprintId: string,
  changes: readonly TaskChange[],
  { startsAt, endsAt, now }: { startsAt: Date; endsAt: Date; now: Date },
): Burndown {
  const sorted = [...changes].sort(byTime);
  const committed = totals(stateAt(sorted, startsAt), sprintId);

  const span = Math.max(1, Math.ceil((endsAt.getTime() - startsAt.getTime()) / DAY));
  const last = Math.min(endsAt.getTime(), now.getTime());
  const days: BurndownPoint[] = [];
  for (let i = 1; i <= span; i++) {
    const at = new Date(Math.min(startsAt.getTime() + i * DAY, endsAt.getTime()));
    if (at.getTime() > last + DAY) break;
    const instant = new Date(Math.min(at.getTime(), last));
    days.push({
      ...totals(stateAt(sorted, instant), sprintId),
      at,
      idealPoints: Math.max(0, Math.round(committed.totalPoints * (1 - i / span) * 100) / 100),
    });
  }

  // Scope change: walk the in-sprint changes after the start, tracking each task's contribution.
  let scopeAdded = 0;
  let scopeRemoved = 0;
  const states = stateAt(sorted, startsAt);
  const counted = (s: TaskState | undefined) =>
    s && !s.deleted && s.sprintId === sprintId && s.category !== 'canceled' ? (s.estimate ?? 0) : 0;
  for (const change of sorted) {
    if (change.at <= startsAt || change.at.getTime() > last) continue;
    const before = counted(states.get(change.taskId));
    const next = apply(states.get(change.taskId) ?? EMPTY, change);
    states.set(change.taskId, next);
    const delta = counted(next) - before;
    if (delta > 0) scopeAdded += delta;
    // Completing work keeps it in scope (delta 0); canceling or moving it out removes it.
    if (delta < 0) scopeRemoved -= delta;
  }

  return { committed, days, scopeAdded, scopeRemoved };
}

export interface FlowPoint {
  /** End of the day (exclusive bound), UTC. */
  at: Date;
  /** Tasks in the sprint not yet started (backlog or to-do statuses). */
  todo: number;
  inProgress: number;
  done: number;
}

/**
 * Cumulative flow: for each day of the sprint, how many of its tasks sit in each stage. Bands that widen show
 * work piling up; a flat "done" band shows nothing finishing. Canceled and deleted tasks are left out, as in the
 * burndown.
 */
export function cumulativeFlow(
  sprintId: string,
  changes: readonly TaskChange[],
  { startsAt, endsAt, now }: { startsAt: Date; endsAt: Date; now: Date },
): FlowPoint[] {
  const sorted = [...changes].sort(byTime);
  const span = Math.max(1, Math.ceil((endsAt.getTime() - startsAt.getTime()) / DAY));
  const last = Math.min(endsAt.getTime(), now.getTime());
  const points: FlowPoint[] = [];
  for (let i = 0; i <= span; i++) {
    const at = new Date(Math.min(startsAt.getTime() + i * DAY, endsAt.getTime()));
    if (at.getTime() > last + DAY) break;
    const point: FlowPoint = { at, todo: 0, inProgress: 0, done: 0 };
    for (const state of stateAt(sorted, new Date(Math.min(at.getTime(), last))).values()) {
      if (state.deleted || state.sprintId !== sprintId || state.category === 'canceled') continue;
      if (state.category === 'completed') point.done++;
      else if (state.category === 'started') point.inProgress++;
      else point.todo++;
    }
    points.push(point);
  }
  return points;
}

export interface SprintOutcome {
  sprintId: string;
  committedPoints: number;
  completedPoints: number;
}

/** Average completed points over the last `window` finished sprints. */
export function velocity(outcomes: readonly SprintOutcome[], window = 3): number {
  const recent = outcomes.slice(-window);
  if (recent.length === 0) return 0;
  return recent.reduce((sum, o) => sum + o.completedPoints, 0) / recent.length;
}

/** Median of the durations in milliseconds, or null for none. */
export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? (sorted[middle] ?? null)
    : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
}

/** Cycle times (first start to completion) of tasks completed in a window. */
export function cycleTimes(
  tasks: readonly { startedAt: Date | null; completedAt: Date | null }[],
  from: Date,
  to: Date,
): number[] {
  return tasks.flatMap((t) =>
    t.startedAt && t.completedAt && t.completedAt >= from && t.completedAt < to
      ? [t.completedAt.getTime() - t.startedAt.getTime()]
      : [],
  );
}
