import { z } from 'zod';

/** Every email TeamFlow sends, as data. The worker renders and delivers them; nothing else touches SMTP. */
export const EmailMessage = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('verify-email'), to: z.email(), code: z.string() }),
  z.object({ kind: z.literal('sign-in-code'), to: z.email(), code: z.string() }),
  z.object({ kind: z.literal('reset-password'), to: z.email(), code: z.string() }),
  z.object({
    kind: z.literal('invitation'),
    to: z.email(),
    invitationId: z.string(),
    organizationName: z.string(),
    inviterName: z.string(),
    role: z.string(),
  }),
  z.object({
    kind: z.literal('digest'),
    to: z.email(),
    name: z.string(),
    organizationName: z.string(),
    frequency: z.enum(['daily', 'weekly']),
    items: z
      .array(
        z.object({
          kind: z.enum(['assigned', 'mentioned', 'commented']),
          actorName: z.string().nullable(),
          identifier: z.string(),
          title: z.string(),
          excerpt: z.string().optional(),
        }),
      )
      .min(1),
    /** Unread items beyond those listed. */
    more: z.number().int().nonnegative(),
  }),
]);
export type EmailMessage = z.infer<typeof EmailMessage>;

/** The pg-boss queue emails travel on. */
export const EMAIL_QUEUE = 'email.send';
