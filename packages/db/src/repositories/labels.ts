import { and, asc, eq, isNull, or } from 'drizzle-orm';
import { labels } from '../schema/projects.ts';
import { inTransaction, type Scope } from '../scope.ts';
import { emit, recordActivity } from './events.ts';

export type LabelRow = typeof labels.$inferSelect;

const inOrg = (scope: Scope) => eq(labels.organizationId, scope.organizationId);

/** Organization-wide labels plus, when given, the labels of one project. */
export function listLabels(scope: Scope, projectId?: string) {
  return scope.db
    .select()
    .from(labels)
    .where(
      and(
        inOrg(scope),
        projectId ? or(isNull(labels.projectId), eq(labels.projectId, projectId)) : undefined,
      ),
    )
    .orderBy(asc(labels.name));
}

export async function findLabel(scope: Scope, id: string): Promise<LabelRow | null> {
  const [row] = await scope.db
    .select()
    .from(labels)
    .where(and(inOrg(scope), eq(labels.id, id)))
    .limit(1);
  return row ?? null;
}

export function createLabel(
  scope: Scope,
  input: { projectId: string | null; name: string; color: string },
) {
  return inTransaction(scope, async (tx) => {
    const [label] = await tx.db
      .insert(labels)
      .values({ organizationId: tx.organizationId, ...input })
      .returning();
    if (!label) throw new Error('insert returned no row');
    await recordActivity(tx, {
      kind: 'label.created',
      projectId: label.projectId,
      changes: [{ field: 'label', from: null, to: label.name }],
    });
    await emit(tx, 'label.changed', { labelId: label.id, projectId: label.projectId });
    return label;
  });
}

export function updateLabel(scope: Scope, id: string, patch: { name?: string; color?: string }) {
  return inTransaction(scope, async (tx) => {
    const before = await findLabel(tx, id);
    const [label] = await tx.db
      .update(labels)
      .set(patch)
      .where(and(inOrg(tx), eq(labels.id, id)))
      .returning();
    if (!label || !before) return null;
    const changes = (['name', 'color'] as const)
      .filter((field) => before[field] !== label[field])
      .map((field) => ({ field, from: before[field], to: label[field] }));
    if (changes.length > 0) {
      await recordActivity(tx, {
        kind: 'label.updated',
        projectId: label.projectId,
        changes: [{ field: 'label', from: before.name, to: label.name }, ...changes],
      });
    }
    await emit(tx, 'label.changed', { labelId: label.id, projectId: label.projectId });
    return label;
  });
}

export function deleteLabel(scope: Scope, id: string) {
  return inTransaction(scope, async (tx) => {
    const [label] = await tx.db
      .delete(labels)
      .where(and(inOrg(tx), eq(labels.id, id)))
      .returning();
    if (!label) return null;
    await recordActivity(tx, {
      kind: 'label.deleted',
      projectId: label.projectId,
      changes: [{ field: 'label', from: label.name, to: null }],
    });
    await emit(tx, 'label.deleted', { labelId: label.id, projectId: label.projectId });
    return label;
  });
}
