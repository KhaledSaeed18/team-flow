import type { ApiToken } from '@teamflow/contract';
import { type ApiTokenRow, createApiToken, deleteApiToken, listApiTokens } from '@teamflow/db';
import { AppError, notFound } from '../errors.ts';
import { displayPrefix, generateSecret, hashSecret, type TokenGrant } from '../tokens.ts';
import type { Actor } from './actor.ts';

type TokenActor = Actor & { token: TokenGrant | null };

const toToken = ({
  id,
  name,
  prefix,
  access,
  expiresAt,
  lastUsedAt,
  createdAt,
}: ApiTokenRow): ApiToken => ({
  id,
  name,
  prefix,
  access,
  expiresAt,
  lastUsedAt,
  createdAt,
});

/** A token must never mint or revoke tokens: a leaked read token could otherwise make itself a write token. */
function fromSession(actor: TokenActor) {
  if (actor.token) {
    throw new AppError('FORBIDDEN', 'Manage API tokens from the app, not with a token.');
  }
}

export const tokensService = {
  async list(actor: TokenActor) {
    fromSession(actor);
    return (await listApiTokens(actor.scope, actor.member.id)).map(toToken);
  },

  async create(
    actor: TokenActor,
    input: { name: string; access: 'read' | 'write'; expiresInDays: number | null },
    now: Date,
  ) {
    fromSession(actor);
    const secret = generateSecret();
    const row = await createApiToken(actor.scope, {
      memberId: actor.member.id,
      name: input.name,
      access: input.access,
      prefix: displayPrefix(secret),
      tokenHash: hashSecret(secret),
      expiresAt:
        input.expiresInDays === null
          ? null
          : new Date(now.getTime() + input.expiresInDays * 24 * 60 * 60 * 1000),
    });
    return { token: toToken(row), secret };
  },

  async revoke(actor: TokenActor, id: string) {
    fromSession(actor);
    if (!(await deleteApiToken(actor.scope, id, actor.member.id)))
      throw notFound('Token not found.');
    return { id };
  },
};
