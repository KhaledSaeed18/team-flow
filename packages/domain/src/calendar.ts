/**
 * Calendar dates as `YYYY-MM-DD` strings: due dates are days, not instants, so there is no timezone to get wrong.
 * Arithmetic goes through UTC midnight.
 */
export type IsoDate = string;
/** A month as `YYYY-MM`. */
export type IsoMonth = string;

const pad = (n: number) => String(n).padStart(2, '0');
const toDate = (iso: IsoDate) => new Date(`${iso}T00:00:00Z`);
const toIso = (date: Date): IsoDate =>
  `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;

export const isIsoMonth = (value: string): value is IsoMonth =>
  /^\d{4}-(0[1-9]|1[0-2])$/.test(value);

export const monthOf = (iso: IsoDate): IsoMonth => iso.slice(0, 7);

export function addDays(iso: IsoDate, days: number): IsoDate {
  const date = toDate(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return toIso(date);
}

export function addMonths(month: IsoMonth, months: number): IsoMonth {
  const [year = 0, m = 1] = month.split('-').map(Number);
  const index = year * 12 + (m - 1) + months;
  return `${Math.floor(index / 12)}-${pad((index % 12) + 1)}`;
}

/** 0 = Sunday … 6 = Saturday. */
export const weekday = (iso: IsoDate) => toDate(iso).getUTCDay();

/**
 * The weeks to show for a month: whole weeks from the one containing the 1st to the one containing the last day,
 * starting on `weekStartsOn` (1 = Monday by default). Days outside the month fill the edges.
 */
export function monthGrid(month: IsoMonth, weekStartsOn = 1): IsoDate[][] {
  const first = `${month}-01`;
  const last = addDays(`${addMonths(month, 1)}-01`, -1);
  let day = addDays(first, -((weekday(first) - weekStartsOn + 7) % 7));
  const weeks: IsoDate[][] = [];
  while (day <= last) {
    const week: IsoDate[] = [];
    for (let i = 0; i < 7; i++) {
      week.push(day);
      day = addDays(day, 1);
    }
    weeks.push(week);
  }
  return weeks;
}
