/** The only source of "now" in services and jobs, so tests can control time without sleeping. */
export interface Clock {
  now(): Date;
}

export const systemClock: Clock = { now: () => new Date() };

/** A clock that only moves when told to. */
export function fixedClock(start: Date | string = '2026-01-01T00:00:00Z') {
  let current = new Date(start);
  return {
    now: () => new Date(current),
    set(to: Date | string) {
      current = new Date(to);
    },
    advance(ms: number) {
      current = new Date(current.getTime() + ms);
    },
  };
}
