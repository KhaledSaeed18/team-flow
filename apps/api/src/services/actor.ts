import { can, type PermissionRequest } from '@teamflow/auth';
import type { Scope } from '@teamflow/db';
import { forbidden } from '../errors.ts';
import type { Member } from '../orpc.ts';

/** Who is acting, and inside which organization. Services take this instead of a request. */
export interface Actor {
  scope: Scope;
  member: Member;
}

/** Throws FORBIDDEN unless the actor's role allows `request`. */
export function authorize(actor: Actor, request: PermissionRequest): void {
  if (!can(actor.member.role, request)) throw forbidden();
}
