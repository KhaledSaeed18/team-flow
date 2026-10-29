import { z } from 'zod';

export const Id = z.uuid();
export const Timestamp = z.coerce.date();

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
