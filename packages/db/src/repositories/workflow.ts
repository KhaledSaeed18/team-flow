import {
  canRemoveStatus,
  rankBetween,
  ranksBetween,
  type StatusCategory,
  validateWorkflow,
} from '@teamflow/domain';
import { and, asc, desc, eq, isNull, sql } from 'drizzle-orm';
import { projects, workflowStatuses } from '../schema/projects.ts';
import { activity, tasks } from '../schema/tasks.ts';
import { inTransaction, type Scope } from '../scope.ts';
import { emit, recordActivity } from './events.ts';
import { lockColumn } from './ranks.ts';
import { InvalidReferenceError } from './tasks.ts';

export type StatusRow = typeof workflowStatuses.$inferSelect;

/** Raised when a change would leave a workflow without somewhere for new or finished work. */
export class InvalidWorkflowError extends Error {
  override name = 'InvalidWorkflowError';
}

/**
 * Workflow invariants span every status of a project, so each change locks the project row first: two admins
 * deleting the last two `completed` statuses at once cannot both succeed.
 */
async function lockedStatuses(tx: Scope, projectId: string) {
  const [project] = await tx.db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.organizationId, tx.organizationId), eq(projects.id, projectId)))
    .for('update')
    .limit(1);
  if (!project) return null;
  return tx.db
    .select()
    .from(workflowStatuses)
    .where(
      and(
        eq(workflowStatuses.organizationId, tx.organizationId),
        eq(workflowStatuses.projectId, projectId),
      ),
    )
    .orderBy(asc(workflowStatuses.rank));
}

export async function findStatus(scope: Scope, id: string): Promise<StatusRow | null> {
  const [row] = await scope.db
    .select()
    .from(workflowStatuses)
    .where(
      and(eq(workflowStatuses.organizationId, scope.organizationId), eq(workflowStatuses.id, id)),
    )
    .limit(1);
  return row ?? null;
}

const rankAfter = (statuses: StatusRow[], afterId: string | null | undefined) => {
  if (afterId === undefined) return rankBetween(statuses.at(-1)?.rank ?? null, null);
  if (afterId === null) return rankBetween(null, statuses[0]?.rank ?? null);
  const index = statuses.findIndex((s) => s.id === afterId);
  if (index === -1) throw new InvalidReferenceError('That status is not in this workflow.');
  return rankBetween(statuses[index]?.rank ?? null, statuses[index + 1]?.rank ?? null);
};

export function createStatus(
  scope: Scope,
  input: {
    projectId: string;
    name: string;
    category: StatusCategory;
    color: string;
    afterId?: string | null | undefined;
  },
) {
  return inTransaction(scope, async (tx) => {
    const statuses = await lockedStatuses(tx, input.projectId);
    if (!statuses) return null;
    const [status] = await tx.db
      .insert(workflowStatuses)
      .values({
        organizationId: tx.organizationId,
        projectId: input.projectId,
        name: input.name,
        category: input.category,
        color: input.color,
        rank: rankAfter(statuses, input.afterId),
      })
      .returning();
    await recordActivity(tx, {
      kind: 'workflow.status_created',
      projectId: input.projectId,
      changes: [{ field: 'status', from: null, to: input.name }],
    });
    await emit(tx, 'workflow.changed', { projectId: input.projectId });
    return status ?? null;
  });
}

export function updateStatus(
  scope: Scope,
  id: string,
  patch: {
    name?: string;
    color?: string;
    category?: StatusCategory;
    afterId?: string | null | undefined;
  },
) {
  return inTransaction(scope, async (tx) => {
    const found = await findStatus(tx, id);
    if (!found) return null;
    const statuses = (await lockedStatuses(tx, found.projectId)) ?? [];
    // Re-read under the project lock, so the checks below never run against a stale copy.
    const current = statuses.find((s) => s.id === id);
    if (!current) return null;
    const { afterId, ...fields } = patch;

    if (fields.category && fields.category !== current.category) {
      const next = statuses.map((s) =>
        s.id === id ? { ...s, category: fields.category ?? s.category } : s,
      );
      if (validateWorkflow(next).length > 0) {
        throw new InvalidWorkflowError(
          'A workflow needs at least one Todo-type and one Done-type status.',
        );
      }
      const [inUse] = await tx.db
        .select({ id: tasks.id })
        .from(tasks)
        .where(
          and(
            eq(tasks.organizationId, tx.organizationId),
            eq(tasks.statusId, id),
            isNull(tasks.deletedAt),
          ),
        )
        .limit(1);
      if (inUse) {
        throw new InvalidWorkflowError(
          'Move the tasks out of this status before changing its type.',
        );
      }
    }

    const others = statuses.filter((s) => s.id !== id);
    const [status] = await tx.db
      .update(workflowStatuses)
      .set({ ...fields, ...(afterId !== undefined ? { rank: rankAfter(others, afterId) } : {}) })
      .where(
        and(eq(workflowStatuses.organizationId, tx.organizationId), eq(workflowStatuses.id, id)),
      )
      .returning();
    // Reordering alone is housekeeping; renames, recolors and type changes are worth an audit line.
    const changes = (['name', 'color', 'category'] as const)
      .filter((field) => fields[field] !== undefined && fields[field] !== current[field])
      .map((field) => ({ field, from: current[field], to: fields[field] ?? null }));
    if (changes.length > 0) {
      await recordActivity(tx, {
        kind: 'workflow.status_updated',
        projectId: current.projectId,
        changes: [{ field: 'status', from: current.name, to: current.name }, ...changes],
      });
    }
    await emit(tx, 'workflow.changed', { projectId: current.projectId });
    return status ?? null;
  });
}

/**
 * Delete a status, moving its tasks to another status of the same category — so no task's lifecycle (and no
 * metric derived from it) changes as a side effect of editing the workflow.
 */
export function deleteStatus(scope: Scope, id: string, moveTasksTo: string, now: Date) {
  return inTransaction(scope, async (tx) => {
    const found = await findStatus(tx, id);
    if (!found) return null;
    const statuses = (await lockedStatuses(tx, found.projectId)) ?? [];
    const current = statuses.find((s) => s.id === id);
    if (!current) return null;
    const target = statuses.find((s) => s.id === moveTasksTo);
    if (!target || target.id === id) {
      throw new InvalidReferenceError('Pick another status of this workflow for its tasks.');
    }
    if (target.category !== current.category) {
      throw new InvalidWorkflowError('Tasks can only move to a status of the same type.');
    }
    if (!canRemoveStatus(statuses, id)) {
      throw new InvalidWorkflowError(
        'A workflow needs at least one Todo-type and one Done-type status.',
      );
    }

    const change = sql`jsonb_build_array(jsonb_build_object(
      'field', 'status',
      'from', jsonb_build_object('id', ${id}::uuid, 'category', ${current.category}::text),
      'to', jsonb_build_object('id', ${target.id}::uuid, 'category', ${target.category}::text)
    ))`;
    await tx.db.insert(activity).select(
      tx.db
        .select({
          id: sql`uuidv7()`.as('id'),
          organizationId: tasks.organizationId,
          projectId: tasks.projectId,
          taskId: tasks.id,
          actorMemberId: sql`${tx.memberId}::uuid`.as('actor_member_id'),
          kind: sql`'task.moved'`.as('kind'),
          changes: change.as('changes'),
          createdAt: sql`${now.toISOString()}::timestamptz`.as('created_at'),
        })
        .from(tasks)
        .where(and(eq(tasks.organizationId, tx.organizationId), eq(tasks.statusId, id))),
    );
    // The moved tasks keep their order but go below the target column's cards, with fresh ranks: their old ranks
    // were only meaningful in the old column and could collide with the new one's.
    await lockColumn(tx, target.id);
    const [last] = await tx.db
      .select({ rank: tasks.rank })
      .from(tasks)
      .where(and(eq(tasks.organizationId, tx.organizationId), eq(tasks.statusId, target.id)))
      .orderBy(desc(tasks.rank))
      .limit(1);
    const moving = await tx.db
      .select({ id: tasks.id })
      .from(tasks)
      .where(and(eq(tasks.organizationId, tx.organizationId), eq(tasks.statusId, id)))
      .orderBy(asc(tasks.rank));
    const ranks = ranksBetween(last?.rank ?? null, null, moving.length);
    for (const [i, task] of moving.entries()) {
      await tx.db
        .update(tasks)
        .set({
          statusId: target.id,
          rank: ranks[i] ?? rankBetween(null, null),
          version: sql`${tasks.version} + 1`,
        })
        .where(and(eq(tasks.organizationId, tx.organizationId), eq(tasks.id, task.id)));
    }
    await tx.db
      .delete(workflowStatuses)
      .where(
        and(eq(workflowStatuses.organizationId, tx.organizationId), eq(workflowStatuses.id, id)),
      );
    await recordActivity(tx, {
      kind: 'workflow.status_deleted',
      projectId: current.projectId,
      changes: [
        { field: 'status', from: current.name, to: null },
        { field: 'movedTo', from: null, to: target.name },
      ],
    });
    await emit(tx, 'workflow.changed', { projectId: current.projectId, movedTo: target.id });
    return current;
  });
}
