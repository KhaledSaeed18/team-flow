import { and, desc, eq, isNull, lt, or } from 'drizzle-orm';
import type { Executor } from '../client.ts';
import { members, users } from '../schema/auth.ts';
import { apiTokens } from '../schema/tokens.ts';
import type { Scope } from '../scope.ts';

export type ApiTokenRow = typeof apiTokens.$inferSelect;

const inOrg = (scope: Scope) => eq(apiTokens.organizationId, scope.organizationId);

export function listApiTokens(scope: Scope, memberId: string) {
  return scope.db
    .select()
    .from(apiTokens)
    .where(and(inOrg(scope), eq(apiTokens.memberId, memberId)))
    .orderBy(desc(apiTokens.createdAt));
}

export async function createApiToken(
  scope: Scope,
  input: Pick<ApiTokenRow, 'memberId' | 'name' | 'prefix' | 'tokenHash' | 'access' | 'expiresAt'>,
) {
  const [row] = await scope.db
    .insert(apiTokens)
    .values({ organizationId: scope.organizationId, ...input })
    .returning();
  if (!row) throw new Error('insert returned no row');
  return row;
}

/** Revoke one of `memberId`'s tokens; null when it is not theirs. */
export async function deleteApiToken(scope: Scope, id: string, memberId: string) {
  const [row] = await scope.db
    .delete(apiTokens)
    .where(and(inOrg(scope), eq(apiTokens.id, id), eq(apiTokens.memberId, memberId)))
    .returning({ id: apiTokens.id });
  return row ?? null;
}

/**
 * Who a token speaks for, looked up by its hash before any organization is known — the one place a token is read
 * across tenants. Expired tokens resolve to nothing; tokens of people who left were deleted with their membership.
 */
export async function resolveApiToken(db: Executor, tokenHash: string, now: Date) {
  const [row] = await db
    .select({ token: apiTokens, member: members, user: users })
    .from(apiTokens)
    .innerJoin(
      members,
      and(eq(members.organizationId, apiTokens.organizationId), eq(members.id, apiTokens.memberId)),
    )
    .innerJoin(users, eq(users.id, members.userId))
    .where(eq(apiTokens.tokenHash, tokenHash))
    .limit(1);
  if (!row) return null;
  if (row.token.expiresAt && row.token.expiresAt <= now) return null;
  return row;
}

/** Record use, at most once a minute per token, so busy scripts do not write on every request. */
export async function touchApiToken(db: Executor, id: string, now: Date) {
  const minuteAgo = new Date(now.getTime() - 60_000);
  await db
    .update(apiTokens)
    .set({ lastUsedAt: now })
    .where(
      and(
        eq(apiTokens.id, id),
        or(isNull(apiTokens.lastUsedAt), lt(apiTokens.lastUsedAt, minuteAgo)),
      ),
    );
}
