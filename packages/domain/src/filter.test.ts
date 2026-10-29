import { describe, expect, test } from 'bun:test';
import {
  activeFacets,
  type FilterableTask,
  matchesFilter,
  normalizeFilter,
  sameFilter,
} from './filter.ts';
import type { StatusCategory } from './workflow.ts';

const categories: Record<string, StatusCategory> = {
  todo: 'unstarted',
  doing: 'started',
  done: 'completed',
  dropped: 'canceled',
};
const context = { memberId: 'm-me', categoryOf: (id: string) => categories[id] };
const task = (patch: Partial<FilterableTask> = {}): FilterableTask => ({
  identifier: 'RF-7',
  title: 'Lidar driver timeouts',
  statusId: 'todo',
  priority: 'high',
  assigneeMemberId: 'm-me',
  labelIds: ['bug'],
  ...patch,
});

describe('matchesFilter', () => {
  test('hides closed work unless asked, or unless a closed status is picked', () => {
    expect(matchesFilter(task({ statusId: 'done' }), {}, context)).toBe(false);
    expect(matchesFilter(task({ statusId: 'dropped' }), { closed: true }, context)).toBe(true);
    expect(matchesFilter(task({ statusId: 'done' }), { status: ['done'] }, context)).toBe(true);
    expect(matchesFilter(task({ statusId: 'doing' }), { status: ['done'] }, context)).toBe(false);
  });

  test('assignee understands me and none, and any-of within the facet', () => {
    expect(matchesFilter(task(), { assignee: ['me'] }, context)).toBe(true);
    expect(matchesFilter(task(), { assignee: ['me'] }, { ...context, memberId: null })).toBe(false);
    expect(matchesFilter(task({ assigneeMemberId: null }), { assignee: ['none'] }, context)).toBe(
      true,
    );
    expect(
      matchesFilter(task({ assigneeMemberId: 'm-2' }), { assignee: ['none', 'm-2'] }, context),
    ).toBe(true);
    expect(matchesFilter(task({ assigneeMemberId: 'm-3' }), { assignee: ['me'] }, context)).toBe(
      false,
    );
  });

  test('facets combine: every facet must match', () => {
    const filter = { priority: ['high' as const, 'urgent' as const], label: ['bug', 'perf'] };
    expect(matchesFilter(task(), filter, context)).toBe(true);
    expect(matchesFilter(task({ priority: 'low' }), filter, context)).toBe(false);
    expect(matchesFilter(task({ labelIds: [] }), filter, context)).toBe(false);
  });

  test('text matches the identifier or title, case-insensitively', () => {
    expect(matchesFilter(task(), { q: 'rf-7' }, context)).toBe(true);
    expect(matchesFilter(task(), { q: '  LIDAR ' }, context)).toBe(true);
    expect(matchesFilter(task(), { q: 'gripper' }, context)).toBe(false);
  });

  test('empty facets are no filter at all', () => {
    expect(matchesFilter(task(), { assignee: [], label: [], priority: [] }, context)).toBe(true);
  });
});

describe('normalizing', () => {
  test('equal filters compare equal regardless of order, blanks and defaults', () => {
    expect(
      sameFilter(
        { label: ['b', 'a'], q: ' x ', closed: false, assignee: [] },
        { q: 'x', label: ['a', 'b', 'a'] },
      ),
    ).toBe(true);
    expect(sameFilter({ closed: true }, {})).toBe(false);
    expect(normalizeFilter({ q: '  ', status: [] })).toEqual({});
  });

  test('counts the facets in use', () => {
    expect(activeFacets({ q: 'x', closed: true })).toBe(0);
    expect(activeFacets({ assignee: ['me'], label: [], priority: ['high'] })).toBe(2);
  });
});
