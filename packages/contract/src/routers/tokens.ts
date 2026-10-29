import { z } from 'zod';
import { base } from '../base.ts';
import { Id, Timestamp } from '../schemas.ts';

export const TokenAccess = z.enum(['read', 'write']);
export const TOKEN_LIFETIMES = [30, 90, 365] as const;

export const ApiToken = z.object({
  id: Id,
  name: z.string(),
  /** The start of the secret, e.g. `tf_3kQ9x…`, so you can tell tokens apart. */
  prefix: z.string(),
  access: TokenAccess,
  expiresAt: Timestamp.nullable(),
  lastUsedAt: Timestamp.nullable(),
  createdAt: Timestamp,
});
export type ApiToken = z.infer<typeof ApiToken>;

const tags = ['API tokens'];

/**
 * Personal access tokens for this API. Each acts as you, in the workspace that was active when it was made; `read`
 * tokens may only make GET requests. Tokens are managed from a signed-in session, never with another token.
 */
export const tokens = {
  list: base
    .route({ method: 'GET', path: '/tokens', summary: 'Your API tokens in this workspace', tags })
    .output(z.array(ApiToken)),

  create: base
    .route({
      method: 'POST',
      path: '/tokens',
      summary: 'Create an API token',
      description: 'The secret is returned once, in this response. Store it now.',
      tags,
      successStatus: 201,
    })
    .input(
      z.object({
        name: z.string().trim().min(1).max(60),
        access: TokenAccess.default('read'),
        /** Days until it stops working; null never expires. */
        expiresInDays: z
          .union([z.literal(30), z.literal(90), z.literal(365)])
          .nullable()
          .default(90),
      }),
    )
    .output(z.object({ token: ApiToken, secret: z.string() })),

  revoke: base
    .route({ method: 'DELETE', path: '/tokens/{id}', summary: 'Revoke an API token', tags })
    .input(z.object({ id: Id }))
    .output(z.object({ id: Id })),
};
