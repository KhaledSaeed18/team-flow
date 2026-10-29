import { describe, expect, test } from 'bun:test';
import { digestDue, digestSince } from './digest.ts';

const at = (iso: string) => new Date(iso);
const now = at('2026-03-10T09:00:00Z');

describe('digestDue', () => {
  test('never when off; always for a first digest', () => {
    expect(digestDue('off', null, now)).toBe(false);
    expect(digestDue('daily', null, now)).toBe(true);
    expect(digestDue('weekly', null, now)).toBe(true);
  });

  test('daily waits about a day; an hourly job a few minutes late still sends', () => {
    expect(digestDue('daily', at('2026-03-09T09:00:00Z'), now)).toBe(true);
    expect(digestDue('daily', at('2026-03-09T09:20:00Z'), now)).toBe(true);
    expect(digestDue('daily', at('2026-03-09T20:00:00Z'), now)).toBe(false);
  });

  test('weekly waits about a week', () => {
    expect(digestDue('weekly', at('2026-03-04T09:00:00Z'), now)).toBe(false);
    expect(digestDue('weekly', at('2026-03-03T09:00:00Z'), now)).toBe(true);
  });
});

describe('digestSince', () => {
  test('starts after the last digest, but never more than a week back', () => {
    expect(digestSince(at('2026-03-09T09:00:00Z'), now)).toEqual(at('2026-03-09T09:00:00Z'));
    expect(digestSince(null, now)).toEqual(at('2026-03-03T09:00:00Z'));
    expect(digestSince(at('2026-01-01T00:00:00Z'), now)).toEqual(at('2026-03-03T09:00:00Z'));
  });
});
