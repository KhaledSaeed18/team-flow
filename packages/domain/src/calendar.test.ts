import { describe, expect, test } from 'bun:test';
import { addDays, addMonths, isIsoMonth, monthGrid, monthOf, weekday } from './calendar.ts';

describe('calendar dates', () => {
  test('day and month arithmetic crosses months, years and leap days', () => {
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
    expect(addMonths('2026-12', 1)).toBe('2027-01');
    expect(addMonths('2026-01', -1)).toBe('2025-12');
    expect(addMonths('2026-03', -15)).toBe('2024-12');
    expect(monthOf('2026-03-17')).toBe('2026-03');
    expect(weekday('2026-03-01')).toBe(0);
  });

  test('validates months', () => {
    expect(isIsoMonth('2026-03')).toBe(true);
    expect(isIsoMonth('2026-13')).toBe(false);
    expect(isIsoMonth('March')).toBe(false);
  });
});

describe('monthGrid', () => {
  test('whole weeks from Monday, covering the month', () => {
    const weeks = monthGrid('2026-03');
    expect(weeks).toHaveLength(6);
    expect(weeks[0]?.[0]).toBe('2026-02-23');
    expect(weeks[0]?.[6]).toBe('2026-03-01');
    expect(weeks.at(-1)?.[6]).toBe('2026-04-05');
    expect(weeks.every((w) => w.length === 7)).toBe(true);
  });

  test('a month that starts on the week start has no leading days; Sunday starts work too', () => {
    expect(monthGrid('2026-06')[0]?.[0]).toBe('2026-06-01');
    expect(monthGrid('2027-02')).toHaveLength(4);
    expect(monthGrid('2026-02')).toHaveLength(5);
    expect(monthGrid('2026-03', 0)[0]?.[0]).toBe('2026-03-01');
  });
});
