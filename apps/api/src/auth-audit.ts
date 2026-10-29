import {
  createScope,
  findMemberSummary,
  findMembership,
  listUserOrganizations,
  recordAuthEvent,
} from '@teamflow/db';
import type { Deps } from './context.ts';

type Body = Record<string, unknown>;
type Change = { field: string; from: unknown; to: unknown };
type Plan = (result: Body) => { kind: string; changes: Change[]; actor?: 'gone' } | null;

const text = (value: unknown) => (typeof value === 'string' ? value : null);

/**
 * Better Auth owns membership, invitations and the workspace record, so their audit lines are written here, around
 * its handler: the session says who acted, the request and response say what happened, and a look beforehand
 * keeps what the change destroys (a previous role, a removed person's name). Failing to record never fails the
 * request; it is logged instead.
 */
export function auditedAuthHandler(deps: Deps) {
  return async (request: Request): Promise<Response> => {
    const path = new URL(request.url).pathname.replace(/^\/api\/auth/, '');
    if (request.method !== 'POST' || !(path in PLANNERS)) return deps.auth.handler(request);

    const body = ((await request
      .clone()
      .json()
      .catch(() => ({}))) ?? {}) as Body;
    const session = await deps.auth.api.getSession({ headers: request.headers });
    const plan = session
      ? await PLANNERS[path]?.(
          deps,
          body,
          session.user.id,
          session.session.activeOrganizationId ?? null,
        )
      : null;

    const response = await deps.auth.handler(request);
    if (!response.ok || !session || !plan) return response;
    try {
      const result = ((await response
        .clone()
        .json()
        .catch(() => ({}))) ?? {}) as Body;
      const organizationId =
        plan.organizationId ?? text((result.invitation as Body | undefined)?.organizationId);
      if (!organizationId) return response;
      const membership = await findMembership(deps.db, organizationId, session.user.id);
      const entry = plan.describe(result);
      if (!entry) return response;
      const actor = entry.actor === 'gone' ? null : (membership?.id ?? null);
      await recordAuthEvent(createScope(deps.db, organizationId, actor), entry.kind, entry.changes);
    } catch (error) {
      deps.logger.error({ err: error, path }, 'could not record audit entry');
    }
    return response;
  };
}

type Planner = (
  deps: Deps,
  body: Body,
  userId: string,
  activeOrganizationId: string | null,
) => Promise<{ organizationId: string | null; describe: Plan } | null>;

const target = async (deps: Deps, organizationId: string | null, memberIdOrEmail: unknown) => {
  const key = text(memberIdOrEmail);
  if (!organizationId || !key) return null;
  return findMemberSummary(createScope(deps.db, organizationId, null), key);
};

const PLANNERS: Record<string, Planner> = {
  '/organization/invite-member': async (_deps, body, _user, active) => ({
    organizationId: text(body.organizationId) ?? active,
    describe: () => ({
      kind: 'member.invited',
      changes: [
        { field: 'email', from: null, to: text(body.email) },
        { field: 'role', from: null, to: text(body.role) },
      ],
    }),
  }),

  '/organization/cancel-invitation': async (_deps, _body, _user, active) => ({
    organizationId: active,
    describe: (result) => ({
      kind: 'invitation.canceled',
      changes: [{ field: 'email', from: text(result.email), to: null }],
    }),
  }),

  // The organization comes from the accepted invitation in the response; the new member is the actor.
  '/organization/accept-invitation': async () => ({
    organizationId: null,
    describe: (result) => ({
      kind: 'member.joined',
      changes: [{ field: 'role', from: null, to: text((result.member as Body | undefined)?.role) }],
    }),
  }),

  '/organization/update-member-role': async (deps, body, _user, active) => {
    const organizationId = text(body.organizationId) ?? active;
    const before = await target(deps, organizationId, body.memberId);
    if (!before) return null;
    return {
      organizationId,
      describe: () => ({
        kind: 'member.role_changed',
        changes: [
          { field: 'member', from: before.name, to: before.name },
          { field: 'role', from: before.role, to: text(body.role) },
        ],
      }),
    };
  },

  '/organization/remove-member': async (deps, body, _user, active) => {
    const organizationId = text(body.organizationId) ?? active;
    const before = await target(deps, organizationId, body.memberIdOrEmail);
    if (!before) return null;
    return {
      organizationId,
      describe: () => ({
        kind: 'member.removed',
        changes: [{ field: 'member', from: before.name, to: null }],
      }),
    };
  },

  // Whoever left is no longer a member, so the line has no actor; their name is the subject.
  '/organization/leave': async (deps, body, userId) => {
    const organizationId = text(body.organizationId);
    const membership = organizationId && (await findMembership(deps.db, organizationId, userId));
    if (!organizationId || !membership) return null;
    const before = await target(deps, organizationId, membership.id);
    return {
      organizationId,
      describe: () => ({
        kind: 'member.left',
        actor: 'gone',
        changes: [{ field: 'member', from: before?.name ?? null, to: null }],
      }),
    };
  },

  '/organization/update': async (deps, body, userId, active) => {
    const organizationId = text(body.organizationId) ?? active;
    const name = text((body.data as Body | undefined)?.name);
    if (!organizationId || !name) return null;
    const current = (await listUserOrganizations(deps.db, userId)).find(
      (o) => o.id === organizationId,
    );
    if (!current || current.name === name) return null;
    return {
      organizationId,
      describe: () => ({
        kind: 'workspace.renamed',
        changes: [{ field: 'name', from: current.name, to: name }],
      }),
    };
  },
};
