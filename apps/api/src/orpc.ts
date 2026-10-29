import { implement } from '@orpc/server';
import { contract } from '@teamflow/contract';
import type { RequestContext } from './context.ts';

export const os = implement(contract).$context<RequestContext>();

/** Requires a signed-in user; narrows `session` for the procedure. */
export const authed = os.middleware(async ({ context, next, errors }) => {
  if (!context.session) throw errors.UNAUTHORIZED();
  return next({ context: { session: context.session } });
});
