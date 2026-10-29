import { implement } from '@orpc/server';
import { isRole, type Role } from '@teamflow/auth';
import { contract } from '@teamflow/contract';
import { createScope, findMembership } from '@teamflow/db';
import type { RequestContext } from './context.ts';
import { toTransportError } from './errors.ts';

const base = implement(contract).$context<RequestContext>();

/** Turns service errors into the contract's typed errors, for every procedure. */
const mapErrors = base.middleware(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    throw toTransportError(error);
  }
});

export const os = base.use(mapErrors);

/** Requires a signed-in user; narrows `session` for the procedure. */
export const authed = base.middleware(async ({ context, next, errors }) => {
  if (!context.session) throw errors.UNAUTHORIZED();
  return next({ context: { session: context.session } });
});

export interface Member {
  id: string;
  role: Role;
}

/**
 * Requires an active organization the user still belongs to, and builds the tenant `Scope` (ADR-0004).
 * The organization comes from the session — procedures never accept one as input.
 */
export const tenant = authed.concat(
  base.middleware(async ({ context, next, errors }) => {
    const session = context.session;
    if (!session) throw errors.UNAUTHORIZED();
    const organizationId = session.session.activeOrganizationId;
    if (!organizationId) throw errors.NO_ACTIVE_ORGANIZATION();

    const membership = await findMembership(context.db, organizationId, session.user.id);
    // Removed from the org since the session picked it: treat as if no org is selected.
    if (!membership) throw errors.NO_ACTIVE_ORGANIZATION();
    const role = membership.role.split(',').find(isRole) ?? 'guest';

    return next({
      context: {
        member: { id: membership.id, role } satisfies Member,
        scope: createScope(context.db, organizationId, membership.id),
      },
    });
  }),
);
