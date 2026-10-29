import { z } from 'zod';
import { Priority } from './task.ts';
import { isClosed, type StatusCategory } from './workflow.ts';

/** `me` and `none` are placeholders, so a saved "My open work" view means the person looking at it. */
export const ME = 'me';
export const UNASSIGNED = 'none';

const Ids = z.array(z.string().min(1).max(64)).max(100);

/**
 * What a list shows. Values within a facet are alternatives (any of); facets combine (all of). Lives in the URL
 * and in saved views, so it must stay small and serializable.
 */
export const TaskFilter = z.object({
  q: z.string().max(200).optional(),
  closed: z.boolean().optional(),
  assignee: Ids.optional(),
  priority: z.array(Priority).max(5).optional(),
  label: Ids.optional(),
  status: Ids.optional(),
});
export type TaskFilter = z.infer<typeof TaskFilter>;

export interface FilterableTask {
  identifier: string;
  title: string;
  statusId: string;
  priority: Priority;
  assigneeMemberId: string | null;
  labelIds: readonly string[];
}

export interface FilterContext {
  /** The viewer's member id, for `me`. */
  memberId: string | null;
  categoryOf: (statusId: string) => StatusCategory | undefined;
}

const some = <T>(values: readonly T[] | undefined): values is readonly T[] =>
  values !== undefined && values.length > 0;

export function matchesFilter(
  task: FilterableTask,
  filter: TaskFilter,
  context: FilterContext,
): boolean {
  if (some(filter.status)) {
    // Picking statuses explicitly shows them, closed or not.
    if (!filter.status.includes(task.statusId)) return false;
  } else if (!filter.closed) {
    const category = context.categoryOf(task.statusId);
    if (category && isClosed(category)) return false;
  }

  if (some(filter.assignee)) {
    const wanted = (value: string) =>
      value === ME
        ? context.memberId !== null && task.assigneeMemberId === context.memberId
        : value === UNASSIGNED
          ? task.assigneeMemberId === null
          : task.assigneeMemberId === value;
    if (!filter.assignee.some(wanted)) return false;
  }

  if (some(filter.priority) && !filter.priority.includes(task.priority)) return false;
  if (some(filter.label) && !filter.label.some((id) => task.labelIds.includes(id))) return false;

  const needle = filter.q?.trim().toLowerCase();
  if (needle) {
    const hay = `${task.identifier} ${task.title}`.toLowerCase();
    if (!hay.includes(needle)) return false;
  }
  return true;
}

/** How many facets narrow the list, for a "Filters · 3" badge. Text search and `closed` are separate controls. */
export const activeFacets = (filter: TaskFilter): number =>
  [filter.assignee, filter.priority, filter.label, filter.status].filter(some).length;

/** Drop empty facets and defaults, so equal filters serialize the same way (for "this view has changes"). */
export function normalizeFilter(filter: TaskFilter): TaskFilter {
  const out: TaskFilter = {};
  const q = filter.q?.trim();
  if (q) out.q = q;
  if (filter.closed) out.closed = true;
  for (const facet of ['assignee', 'priority', 'label', 'status'] as const) {
    const values = filter[facet];
    if (some(values)) (out as Record<string, unknown>)[facet] = [...new Set(values)].sort();
  }
  return out;
}

export const sameFilter = (a: TaskFilter, b: TaskFilter): boolean =>
  JSON.stringify(normalizeFilter(a)) === JSON.stringify(normalizeFilter(b));
