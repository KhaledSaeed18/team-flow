import { z } from 'zod';

export const DIGEST_FREQUENCIES = ['off', 'daily', 'weekly'] as const;
export const DigestFrequency = z.enum(DIGEST_FREQUENCIES);
export type DigestFrequency = z.infer<typeof DigestFrequency>;

const DAY = 24 * 60 * 60 * 1000;
/** How long after one digest the next may go out. A little under a full period, so an hourly job never slips a day. */
export const DIGEST_INTERVAL_MS: Record<Exclude<DigestFrequency, 'off'>, number> = {
  daily: DAY - 30 * 60 * 1000,
  weekly: 7 * DAY - 30 * 60 * 1000,
};
/** A first digest never reaches further back than this. */
export const DIGEST_LOOKBACK_MS = 7 * DAY;

export function digestDue(frequency: DigestFrequency, lastSentAt: Date | null, now: Date): boolean {
  if (frequency === 'off') return false;
  return (
    lastSentAt === null || now.getTime() - lastSentAt.getTime() >= DIGEST_INTERVAL_MS[frequency]
  );
}

/** Notifications newer than this belong in the next digest. */
export function digestSince(lastSentAt: Date | null, now: Date): Date {
  const floor = new Date(now.getTime() - DIGEST_LOOKBACK_MS);
  return lastSentAt && lastSentAt > floor ? lastSentAt : floor;
}
