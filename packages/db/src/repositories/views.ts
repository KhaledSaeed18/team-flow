import { and, asc, eq, or, sql } from 'drizzle-orm';
import { StaleWriteError } from '../errors.ts';
import { members, users } from '../schema/auth.ts';
import { savedViews } from '../schema/views.ts';
import { inTransaction, type Scope } from '../scope.ts';
import { emit } from './events.ts';

export type SavedViewRow = typeof savedViews.$inferSelect;
export type SavedViewInput = Pick<
  SavedViewRow,
  'projectId' | 'name' | 'shared' | 'filter' | 'sort' | 'direction'
>;
export type SavedViewPatch = Partial<Omit<SavedViewInput, 'projectId'>>;

const inOrg = (scope: Scope) => eq(savedViews.organizationId, scope.organizationId);

/** The caller's own views in a project, plus everyone's shared ones; with the owner's name. */
export function listSavedViews(scope: Scope, projectId: string, memberId: string) {
  return scope.db
    .select({ view: savedViews, ownerName: users.name })
    .from(savedViews)
    .innerJoin(
      members,
      and(
        eq(members.organizationId, savedViews.organizationId),
        eq(members.id, savedViews.ownerMemberId),
      ),
    )
    .innerJoin(users, eq(users.id, members.userId))
    .where(
      and(
        inOrg(scope),
        eq(savedViews.projectId, projectId),
        or(eq(savedViews.ownerMemberId, memberId), eq(savedViews.shared, true)),
      ),
    )
    .orderBy(asc(savedViews.name), asc(savedViews.id));
}

export async function findSavedView(scope: Scope, id: string): Promise<SavedViewRow | null> {
  const [row] = await scope.db
    .select()
    .from(savedViews)
    .where(and(inOrg(scope), eq(savedViews.id, id)))
    .limit(1);
  return row ?? null;
}

export function createSavedView(scope: Scope, ownerMemberId: string, input: SavedViewInput) {
  return inTransaction(scope, async (tx) => {
    const [row] = await tx.db
      .insert(savedViews)
      .values({ organizationId: tx.organizationId, ownerMemberId, ...input })
      .returning();
    if (!row) throw new Error('insert returned no row');
    if (row.shared) await emit(tx, 'views.changed', { projectId: row.projectId });
    return row;
  });
}

/** Optimistic: a stale `expectedVersion` throws `StaleWriteError`. */
export function updateSavedView(
  scope: Scope,
  id: string,
  expectedVersion: number,
  patch: SavedViewPatch,
  now: Date,
) {
  return inTransaction(scope, async (tx) => {
    const [current] = await tx.db
      .select()
      .from(savedViews)
      .where(and(inOrg(tx), eq(savedViews.id, id)))
      .for('update')
      .limit(1);
    if (!current) return null;
    if (current.version !== expectedVersion) throw new StaleWriteError(current.version);
    const [row] = await tx.db
      .update(savedViews)
      .set({ ...patch, version: sql`${savedViews.version} + 1`, updatedAt: now })
      .where(and(inOrg(tx), eq(savedViews.id, id)))
      .returning();
    if (!row) return null;
    // Others only ever see shared views, so a private one changing concerns nobody else.
    if (row.shared || current.shared) await emit(tx, 'views.changed', { projectId: row.projectId });
    return row;
  });
}

export function deleteSavedView(scope: Scope, id: string) {
  return inTransaction(scope, async (tx) => {
    const [row] = await tx.db
      .delete(savedViews)
      .where(and(inOrg(tx), eq(savedViews.id, id)))
      .returning();
    if (row?.shared) await emit(tx, 'views.changed', { projectId: row.projectId });
    return row ?? null;
  });
}
