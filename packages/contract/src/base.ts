import { oc } from '@orpc/contract';
import { z } from 'zod';

/**
 * Errors every procedure may raise. Status codes follow docs/CONVENTIONS.md:
 * a resource the caller may not see is NOT_FOUND; one they can see but may not change is FORBIDDEN.
 */
export const base = oc.errors({
  UNAUTHORIZED: { status: 401, message: 'Sign in to continue.' },
  FORBIDDEN: { status: 403, message: 'You do not have permission to do that.' },
  NOT_FOUND: { status: 404, message: 'Not found.' },
  CONFLICT: {
    status: 409,
    message: 'This was changed by someone else. Reload and try again.',
    data: z.object({ currentVersion: z.number().int().optional() }).optional(),
  },
  NO_ACTIVE_ORGANIZATION: { status: 412, message: 'Select an organization first.' },
});
