import { z } from 'zod';

/**
 * Every project has its own workflow: an ordered list of statuses, each belonging to one fixed category.
 * Categories carry the meaning (board grouping, metrics, timestamps); status names are just labels.
 */
export const STATUS_CATEGORIES = [
  'backlog',
  'unstarted',
  'started',
  'completed',
  'canceled',
] as const;
export const StatusCategory = z.enum(STATUS_CATEGORIES);
export type StatusCategory = z.infer<typeof StatusCategory>;

/** Categories in which a task counts as finished for velocity, burndown and "done" filters. */
export const isClosed = (category: StatusCategory): boolean =>
  category === 'completed' || category === 'canceled';

export interface WorkflowStatusTemplate {
  name: string;
  category: StatusCategory;
  color: string;
}

/** The workflow new projects start with. */
export const DEFAULT_WORKFLOW: readonly WorkflowStatusTemplate[] = [
  { name: 'Backlog', category: 'backlog', color: '#94a3b8' },
  { name: 'Todo', category: 'unstarted', color: '#64748b' },
  { name: 'In Progress', category: 'started', color: '#f59e0b' },
  { name: 'In Review', category: 'started', color: '#8b5cf6' },
  { name: 'Done', category: 'completed', color: '#22c55e' },
  { name: 'Canceled', category: 'canceled', color: '#ef4444' },
];

export interface WorkflowStatusLike {
  id: string;
  category: StatusCategory;
}

export type WorkflowProblem =
  | { code: 'missing_category'; category: 'unstarted' | 'completed' }
  | { code: 'last_in_category'; category: StatusCategory };

/** A workflow must keep somewhere for new work to land and somewhere for finished work to go. */
export function validateWorkflow(statuses: readonly WorkflowStatusLike[]): WorkflowProblem[] {
  const problems: WorkflowProblem[] = [];
  for (const category of ['unstarted', 'completed'] as const) {
    if (!statuses.some((s) => s.category === category)) {
      problems.push({ code: 'missing_category', category });
    }
  }
  return problems;
}

/** Whether removing `statusId` would leave the workflow invalid. */
export function canRemoveStatus(
  statuses: readonly WorkflowStatusLike[],
  statusId: string,
): boolean {
  return validateWorkflow(statuses.filter((s) => s.id !== statusId)).length === 0;
}

export interface LifecycleTimestamps {
  startedAt: Date | null;
  completedAt: Date | null;
  canceledAt: Date | null;
}

/**
 * Timestamps after a task moves from one category to another.
 *
 * - `startedAt` is set the first time work starts and kept if the task moves back, so cycle time measures from the
 *   first start. Moving back to backlog/unstarted clears it: the work was abandoned, not paused.
 * - `completedAt` / `canceledAt` reflect the current closed state only.
 */
export function nextLifecycle(
  current: LifecycleTimestamps,
  to: StatusCategory,
  now: Date,
): LifecycleTimestamps {
  switch (to) {
    case 'backlog':
    case 'unstarted':
      return { startedAt: null, completedAt: null, canceledAt: null };
    case 'started':
      return { startedAt: current.startedAt ?? now, completedAt: null, canceledAt: null };
    case 'completed':
      return { startedAt: current.startedAt ?? now, completedAt: now, canceledAt: null };
    case 'canceled':
      return { startedAt: current.startedAt, completedAt: null, canceledAt: now };
  }
}
