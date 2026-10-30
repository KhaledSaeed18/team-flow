import {
  createScope,
  findInvitation,
  findMemberSummary,
  findMembership,
  listUserOrganizations,
  pendingInvitations,
  recordAuthEvent,
} from '@teamflow/db';
import type { Deps } from './context.ts';

type Body = Record<string, unknown>;
type Change = { field: string; from: unknown; to: unknown };
type Entry = { kind: string; changes: Change[]; actor?: 'gone' };
type Plan = (result: Body) => Entry | Entry[] | null;

const text = (value: unknown) => (typeof value === 'string' ? value : null);
/** A role as Better Auth accepts it: a string, or a list of one (anything longer is refused before this runs). */
const roleOf = (value: unknown) => (Array.isArray(value) ? text(value[0]) : text(value));

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
        plan.organizationId ??
        text((result.invitation as Body | undefined)?.organizationId) ??
        text(result.organizationId);
      if (!organizationId) return response;
      const membership = await findMembership(deps.db, organizationId, session.user.id);
      const described = plan.describe(result);
      for (const entry of described ? [described].flat() : []) {
        const actor = entry.actor === 'gone' ? null : (membership?.id ?? null);
        await recordAuthEvent(
          createScope(deps.db, organizationId, actor),
          entry.kind,
          entry.changes,
        );
      }
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
  // Inviting an address again cancels its earlier pending invitations (Better Auth's
  // `cancelPendingInvitationsOnReInvite`); those cancellations are recorded too.
  '/organization/invite-member': async (deps, body, _user, active) => {
    const organizationId = text(body.organizationId) ?? active;
    const email = text(body.email);
    const earlier =
      organizationId && email ? await pendingInvitations(deps.db, organizationId, email) : [];
    return {
      organizationId,
      describe: () => [
        ...earlier.map(() => ({
          kind: 'invitation.canceled',
          changes: [{ field: 'email', from: email, to: null }],
        })),
        {
          kind: 'member.invited',
          changes: [
            { field: 'email', from: null, to: email },
            { field: 'role', from: null, to: roleOf(body.role) },
          ],
        },
      ],
    };
  },

  // The invitation may belong to a workspace other than the active one; its own organization comes back in the
  // response.
  // Only a pending invitation is really canceled; cancelling one already accepted changes nothing worth a line.
  '/organization/cancel-invitation': async (deps, body) => {
    const id = text(body.invitationId);
    const before = id ? await findInvitation(deps.db, id) : null;
    if (!before || before.status !== 'pending') return null;
    return {
      organizationId: before.organizationId,
      describe: () => ({
        kind: 'invitation.canceled',
        changes: [{ field: 'email', from: before.email, to: null }],
      }),
    };
  },

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
          { field: 'role', from: before.role, to: roleOf(body.role) },
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
