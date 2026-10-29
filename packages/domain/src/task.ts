import { z } from 'zod';

/** Priority, most to least urgent; `none` sorts last. */
export const PRIORITIES = ['urgent', 'high', 'medium', 'low', 'none'] as const;
export const Priority = z.enum(PRIORITIES);
export type Priority = z.infer<typeof Priority>;

export const comparePriority = (a: Priority, b: Priority): number =>
  PRIORITIES.indexOf(a) - PRIORITIES.indexOf(b);

/**
 * Directed relations between tasks. `blocks` reads "source blocks target"; `relates` and `duplicates` are
 * shown on both sides. "Blocked by" is not stored — it is `blocks` seen from the target.
 */
export const RELATION_TYPES = ['blocks', 'relates', 'duplicates'] as const;
export const RelationType = z.enum(RELATION_TYPES);
export type RelationType = z.infer<typeof RelationType>;

/** Project keys: an uppercase letter followed by 1–5 uppercase letters or digits. */
export const ProjectKey = z
  .string()
  .regex(/^[A-Z][A-Z0-9]{1,5}$/, 'Use 2–6 uppercase letters or digits.');

export const taskIdentifier = (projectKey: string, number: number): string =>
  `${projectKey}-${number}`;

/** Parse `TF-42` (case-insensitive) into its parts. */
export function parseTaskIdentifier(value: string): { key: string; number: number } | null {
  const match = /^([A-Za-z][A-Za-z0-9]{1,5})-(\d{1,9})$/.exec(value.trim());
  if (!match?.[1] || !match[2]) return null;
  return { key: match[1].toUpperCase(), number: Number(match[2]) };
}

/** Suggest a project key from its name: initials, else the first letters. */
export function suggestProjectKey(name: string): string {
  const words = name
    .normalize('NFKD')
    .replace(/[^A-Za-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  const initials = words.map((w) => w[0]).join('');
  const candidate = (initials.length >= 2 ? initials : (words[0] ?? 'PR'))
    .toUpperCase()
    .slice(0, 4);
  const key = /^[A-Z]/.test(candidate) ? candidate : `P${candidate}`.slice(0, 4);
  return key.length >= 2 ? key : `${key}X`;
}
