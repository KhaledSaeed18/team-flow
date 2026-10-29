import type { Session } from '@teamflow/auth';
import { resolveApiToken, touchApiToken } from '@teamflow/db';
import type { Deps } from './context.ts';

/** What a request authenticated by a personal access token may do. */
export interface TokenGrant {
  id: string;
  access: 'read' | 'write';
}

const PREFIX = 'tf_';

/** A new secret: `tf_` and 32 random bytes, base64url. */
export function generateSecret(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return PREFIX + Buffer.from(bytes).toString('base64url');
}

export const hashSecret = (secret: string) =>
  new Bun.CryptoHasher('sha256').update(secret).digest('hex');

export const displayPrefix = (secret: string) => `${secret.slice(0, PREFIX.length + 6)}…`;

export type TokenAuth =
  | { kind: 'none' }
  | { kind: 'invalid' }
  | { kind: 'ok'; session: Session; grant: TokenGrant };

/**
 * Authenticate `Authorization: Bearer tf_…`. A valid token stands in for a session pinned to the token's
 * organization, so procedures and the tenant middleware treat it like any signed-in member.
 */
export async function authenticateToken(deps: Deps, headers: Headers): Promise<TokenAuth> {
  const header = headers.get('authorization');
  if (!header) return { kind: 'none' };
  const [scheme, secret] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !secret?.startsWith(PREFIX)) return { kind: 'invalid' };

  const now = deps.clock.now();
  const found = await resolveApiToken(deps.db, hashSecret(secret), now);
  if (!found) return { kind: 'invalid' };
  const { token, user } = found;
  await touchApiToken(deps.db, token.id, now).catch((error) =>
    deps.logger.warn({ err: error }, 'could not record token use'),
  );

  const session = {
    user,
    session: {
      id: `token:${token.id}`,
      token: '',
      userId: user.id,
      activeOrganizationId: token.organizationId,
      expiresAt: token.expiresAt ?? new Date(now.getTime() + 60_000),
      createdAt: token.createdAt,
      updatedAt: now,
      ipAddress: null,
      userAgent: null,
    },
  } as unknown as Session;
  return { kind: 'ok', session, grant: { id: token.id, access: token.access } };
}
