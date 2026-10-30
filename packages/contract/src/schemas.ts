import { z } from 'zod';

export const Id = z.uuid();
export const Timestamp = z.coerce.date();

/**
 * A yes/no input that may arrive as a real boolean (RPC) or as a query string (REST). `z.coerce.boolean()` would
 * read the string "false" as true; this accepts `true`/`false`, `1`/`0`, `yes`/`no` and `on`/`off`.
 */
export const Flag = z.union([z.boolean(), z.stringbool()]);

export const Role = z.enum(['owner', 'admin', 'member', 'guest']);
export type Role = z.infer<typeof Role>;

export const User = z.object({
  id: Id,
  name: z.string(),
  email: z.email(),
  image: z.string().nullable(),
});
export type User = z.infer<typeof User>;

export const OrganizationSummary = z.object({
  id: Id,
  name: z.string(),
  slug: z.string(),
  logo: z.string().nullable(),
  role: z.string(),
});
export type OrganizationSummary = z.infer<typeof OrganizationSummary>;

export const Color = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use a hex color like #6366f1.');
export const Version = z.number().int().positive();
