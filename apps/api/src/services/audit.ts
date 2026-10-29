import { listAuditLog } from '@teamflow/db';
import { type Actor, authorize } from './actor.ts';

export const auditService = {
  async list(actor: Actor, input: { before?: string | undefined; limit: number }) {
    authorize(actor, { audit: ['read'] });
    // One extra row says whether there is an older page.
    const rows = await listAuditLog(actor.scope, {
      limit: input.limit + 1,
      ...(input.before ? { before: input.before } : {}),
    });
    const page = rows.slice(0, input.limit);
    return {
      entries: page.map(({ projectKey, projectName, ...row }) => ({
        ...row,
        project: projectKey && projectName ? { key: projectKey, name: projectName } : null,
      })),
      nextBefore: rows.length > input.limit ? (page.at(-1)?.id ?? null) : null,
    };
  },
};
