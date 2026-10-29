import { z } from 'zod';
import { base } from '../base.ts';
import { Id, Timestamp } from '../schemas.ts';

export const AuditEntry = z.object({
  id: Id,
  /** What happened, e.g. `member.role_changed`, `project.archived`, `token.created`. */
  kind: z.string(),
  changes: z.array(z.object({ field: z.string(), from: z.unknown(), to: z.unknown() })),
  /** Null when the person has since left, or acted as they left. */
  actorName: z.string().nullable(),
  project: z.object({ key: z.string(), name: z.string() }).nullable(),
  createdAt: Timestamp,
});
export type AuditEntry = z.infer<typeof AuditEntry>;

export const audit = {
  list: base
    .route({
      method: 'GET',
      path: '/audit',
      summary: 'The workspace audit trail, newest first',
      description:
        'People, invitations, projects, workflows, labels, sprints and API tokens. Admins and owners only. Page with `before`.',
      tags: ['Audit'],
    })
    .input(
      z
        .object({
          before: Id.optional(),
          limit: z.coerce.number().int().min(1).max(100).default(50),
        })
        .default({ limit: 50 }),
    )
    .output(z.object({ entries: z.array(AuditEntry), nextBefore: Id.nullable() })),
};
