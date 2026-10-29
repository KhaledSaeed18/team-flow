import { ORPCError } from '@orpc/server';
import { isRole } from '@teamflow/auth';
import { MAX_ATTACHMENT_BYTES } from '@teamflow/contract';
import { createScope, findMembership } from '@teamflow/db';
import type { Context } from 'hono';
import type { Deps } from './context.ts';
import { toTransportError } from './errors.ts';
import { attachmentsService } from './services/attachments.ts';

const reply = (c: Context, status: number, code: string, message: string) =>
  c.json({ code, message }, status as 400);

/**
 * `POST /api/tasks/:taskId/attachments?name=<file name>` with the file as the raw body. Uploads go through the
 * api rather than straight to the store, so the browser never needs credentials or CORS on the bucket, and the
 * size limit and permissions are checked in one place. Downloads use short-lived signed URLs instead.
 */
export function uploadAttachment(deps: Deps) {
  const service = attachmentsService(deps.storage);
  return async (c: Context) => {
    const session = await deps.auth.api.getSession({ headers: c.req.raw.headers });
    if (!session) return reply(c, 401, 'UNAUTHORIZED', 'Sign in first.');
    const organizationId = session.session.activeOrganizationId;
    const membership =
      organizationId && (await findMembership(deps.db, organizationId, session.user.id));
    if (!organizationId || !membership) {
      return reply(c, 403, 'NO_ACTIVE_ORGANIZATION', 'Pick a workspace first.');
    }

    const declared = Number(c.req.header('content-length') ?? 0);
    if (declared > MAX_ATTACHMENT_BYTES) return tooLarge(c);
    const body = await c.req.arrayBuffer();
    if (body.byteLength > MAX_ATTACHMENT_BYTES) return tooLarge(c);

    const role = membership.role.split(',').find(isRole) ?? 'guest';
    const actor = {
      scope: createScope(deps.db, organizationId, membership.id),
      member: { id: membership.id, role },
    };
    try {
      const created = await service.upload(
        actor,
        {
          taskId: c.req.param('taskId') ?? '',
          fileName: c.req.query('name') ?? 'file',
          contentType: c.req.header('content-type') || 'application/octet-stream',
          body,
        },
        deps.clock.now(),
      );
      return c.json(created, 201);
    } catch (error) {
      const mapped = toTransportError(error);
      if (mapped instanceof ORPCError) return reply(c, mapped.status, mapped.code, mapped.message);
      throw error;
    }
  };
}

const tooLarge = (c: Context) =>
  reply(c, 413, 'TOO_LARGE', `Files can be up to ${MAX_ATTACHMENT_BYTES / 1024 / 1024} MB.`);
