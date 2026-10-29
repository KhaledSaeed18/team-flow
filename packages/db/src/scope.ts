import type { Executor } from './client.ts';

/**
 * The tenant boundary (ADR-0004). Repositories for tenant-owned tables take a `Scope` and filter on
 * `scope.organizationId` in every statement; the organization in it comes from the session, never from input.
 */
export interface Scope {
  readonly organizationId: string;
  /** The acting member, recorded on activity and created-by columns. `null` for system work. */
  readonly memberId: string | null;
  readonly db: Executor;
}

export const createScope = (
  db: Executor,
  organizationId: string,
  memberId: string | null,
): Scope => ({
  db,
  organizationId,
  memberId,
});

/** Run `fn` in one transaction with a scope bound to it. Nested calls reuse the outer transaction. */
export function inTransaction<T>(scope: Scope, fn: (tx: Scope) => Promise<T>): Promise<T> {
  return scope.db.transaction((tx) => fn({ ...scope, db: tx }));
}
