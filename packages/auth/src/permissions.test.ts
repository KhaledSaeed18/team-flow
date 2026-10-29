import { describe, expect, test } from 'bun:test';
import {
  type Action,
  can,
  canAssignRole,
  type Resource,
  ROLES,
  statements,
} from './permissions.ts';

/**
 * The full matrix, written out. A new action must be placed here deliberately, or this test fails.
 */
const MATRIX: Record<string, readonly (typeof ROLES)[number][]> = {
  'organization:update': ['owner', 'admin'],
  'organization:delete': ['owner'],
  'member:create': ['owner', 'admin'],
  'member:update': ['owner', 'admin'],
  'member:delete': ['owner', 'admin'],
  'invitation:create': ['owner', 'admin'],
  'invitation:cancel': ['owner', 'admin'],
  'team:create': ['owner', 'admin'],
  'team:update': ['owner', 'admin'],
  'team:delete': ['owner', 'admin'],
  'ac:create': ['owner', 'admin'],
  'ac:read': ['owner', 'admin', 'member'],
  'ac:update': ['owner', 'admin'],
  'ac:delete': ['owner', 'admin'],
  'project:create': ['owner', 'admin', 'member'],
  'project:update': ['owner', 'admin', 'member'],
  'project:archive': ['owner', 'admin'],
  'project:delete': ['owner', 'admin'],
  'workflow:update': ['owner', 'admin'],
  'task:create': ['owner', 'admin', 'member'],
  'task:update': ['owner', 'admin', 'member'],
  'task:delete': ['owner', 'admin', 'member'],
  'sprint:create': ['owner', 'admin', 'member'],
  'sprint:update': ['owner', 'admin', 'member'],
  'sprint:delete': ['owner', 'admin'],
  'label:create': ['owner', 'admin', 'member'],
  'label:update': ['owner', 'admin', 'member'],
  'label:delete': ['owner', 'admin'],
  'comment:create': ['owner', 'admin', 'member', 'guest'],
  'comment:moderate': ['owner', 'admin'],
  'integration:manage': ['owner', 'admin'],
  'audit:read': ['owner', 'admin'],
};

const allActions = Object.entries(statements).flatMap(([resource, actions]) =>
  actions.map((action) => `${resource}:${action}`),
);

describe('permission matrix', () => {
  test('covers every action exactly', () => {
    expect(Object.keys(MATRIX).sort()).toEqual([...allActions].sort());
  });

  for (const key of allActions) {
    const [resource, action] = key.split(':') as [Resource, Action<Resource>];
    for (const role of ROLES) {
      const expected = MATRIX[key]?.includes(role) ?? false;
      test(`${role} ${expected ? 'can' : 'cannot'} ${key}`, () => {
        expect(can(role, { [resource]: [action] })).toBe(expected);
      });
    }
  }
});

describe('can', () => {
  test('a member with several roles gets the union', () => {
    expect(can('guest,admin', { project: ['delete'] })).toBe(true);
  });

  test('unknown roles grant nothing', () => {
    expect(can('superuser', { comment: ['create'] })).toBe(false);
    expect(can('', { comment: ['create'] })).toBe(false);
  });
});

describe('canAssignRole', () => {
  test('nobody grants above their own role', () => {
    expect(canAssignRole('admin', 'owner')).toBe(false);
    expect(canAssignRole('admin', 'admin')).toBe(true);
    expect(canAssignRole('owner', 'owner')).toBe(true);
    expect(canAssignRole('member', 'guest')).toBe(true);
  });
});
