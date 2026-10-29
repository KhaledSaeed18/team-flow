import { describe, expect, test } from 'bun:test';
import {
  comparePriority,
  PRIORITIES,
  ProjectKey,
  parseTaskIdentifier,
  suggestProjectKey,
  taskIdentifier,
} from './task.ts';

describe('task identifiers', () => {
  test('format and parse round-trip', () => {
    expect(taskIdentifier('TF', 42)).toBe('TF-42');
    expect(parseTaskIdentifier('TF-42')).toEqual({ key: 'TF', number: 42 });
    expect(parseTaskIdentifier(' tf-7 ')).toEqual({ key: 'TF', number: 7 });
  });

  test('reject things that are not identifiers', () => {
    for (const value of ['TF', '42', 'TF-', '-42', 'T-1', 'TOOLONGKEY-1', 'TF-1x']) {
      expect(parseTaskIdentifier(value)).toBeNull();
    }
  });
});

describe('project keys', () => {
  test('validation', () => {
    expect(ProjectKey.safeParse('TF').success).toBe(true);
    expect(ProjectKey.safeParse('WEB2').success).toBe(true);
    expect(ProjectKey.safeParse('tf').success).toBe(false);
    expect(ProjectKey.safeParse('2TF').success).toBe(false);
    expect(ProjectKey.safeParse('T').success).toBe(false);
  });

  test('suggestions are always valid', () => {
    expect(suggestProjectKey('Team Flow')).toBe('TF');
    expect(suggestProjectKey('Mobile app redesign')).toBe('MAR');
    expect(suggestProjectKey('Website')).toBe('WEBS');
    expect(suggestProjectKey('2026 roadmap')).toBe('P2R');
    for (const name of ['x', '!!!', 'Ünïcödé project', '', '9']) {
      expect(ProjectKey.safeParse(suggestProjectKey(name)).success).toBe(true);
    }
  });
});

describe('priority order', () => {
  test('urgent first, none last', () => {
    expect([...PRIORITIES].reverse().sort(comparePriority)).toEqual([...PRIORITIES]);
  });
});
