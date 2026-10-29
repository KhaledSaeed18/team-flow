import { type RelationType, type StatusCategory, taskIdentifier } from '@teamflow/domain';
import { and, eq, isNull, or } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { projects, workflowStatuses } from '../schema/projects.ts';
import { taskRelations, tasks } from '../schema/tasks.ts';
import { inTransaction, type Scope } from '../scope.ts';
import { emit, recordActivity } from './events.ts';
import { InvalidReferenceError } from './tasks.ts';

export interface RelationView {
  id: string;
  type: RelationType;
  /** `outgoing`: this task → other ("blocks"). `incoming`: other → this task ("blocked by"). */
  direction: 'outgoing' | 'incoming';
  task: { id: string; identifier: string; title: string; statusCategory: StatusCategory };
}

/** Every relation touching a task, from that task's point of view. */
export async function listRelations(scope: Scope, taskId: string): Promise<RelationView[]> {
  const other = alias(tasks, 'other');
  const rows = await scope.db
    .select({
      id: taskRelations.id,
      type: taskRelations.type,
      sourceTaskId: taskRelations.sourceTaskId,
      otherId: other.id,
      otherNumber: other.number,
      otherTitle: other.title,
      key: projects.key,
      category: workflowStatuses.category,
    })
    .from(taskRelations)
    .innerJoin(
      other,
      and(
        eq(other.organizationId, taskRelations.organizationId),
        or(
          and(eq(taskRelations.sourceTaskId, taskId), eq(other.id, taskRelations.targetTaskId)),
          and(eq(taskRelations.targetTaskId, taskId), eq(other.id, taskRelations.sourceTaskId)),
        ),
      ),
    )
    .innerJoin(
      projects,
      and(eq(projects.organizationId, other.organizationId), eq(projects.id, other.projectId)),
    )
    .innerJoin(
      workflowStatuses,
      and(
        eq(workflowStatuses.organizationId, other.organizationId),
        eq(workflowStatuses.id, other.statusId),
      ),
    )
    .where(and(eq(taskRelations.organizationId, scope.organizationId), isNull(other.deletedAt)));

  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    direction: r.sourceTaskId === taskId ? 'outgoing' : 'incoming',
    task: {
      id: r.otherId,
      identifier: taskIdentifier(r.key, r.otherNumber),
      title: r.otherTitle,
      statusCategory: r.category,
    },
  }));
}

async function liveTask(tx: Scope, id: string) {
  const [row] = await tx.db
    .select({ id: tasks.id, projectId: tasks.projectId })
    .from(tasks)
    .where(
      and(eq(tasks.organizationId, tx.organizationId), eq(tasks.id, id), isNull(tasks.deletedAt)),
    )
    .limit(1);
  return row ?? null;
}

/**
 * Relate two tasks (they may be in different projects of the organization). `relates` and `duplicates` are
 * stored once whichever way round they were added; asking for an existing relation again is a no-op.
 */
export function addRelation(
  scope: Scope,
  input: { sourceTaskId: string; targetTaskId: string; type: RelationType },
  now: Date,
) {
  return inTransaction(scope, async (tx) => {
    if (input.sourceTaskId === input.targetTaskId) {
      throw new InvalidReferenceError('A task cannot be related to itself.');
    }
    const [source, target] = await Promise.all([
      liveTask(tx, input.sourceTaskId),
      liveTask(tx, input.targetTaskId),
    ]);
    if (!source || !target) return null;

    const symmetric = input.type !== 'blocks';
    const [existing] = await tx.db
      .select({ id: taskRelations.id })
      .from(taskRelations)
      .where(
        and(
          eq(taskRelations.organizationId, tx.organizationId),
          eq(taskRelations.type, input.type),
          or(
            and(
              eq(taskRelations.sourceTaskId, source.id),
              eq(taskRelations.targetTaskId, target.id),
            ),
            symmetric
              ? and(
                  eq(taskRelations.sourceTaskId, target.id),
                  eq(taskRelations.targetTaskId, source.id),
                )
              : undefined,
          ),
        ),
      )
      .limit(1);
    if (existing) return existing;

    if (input.type === 'blocks') {
      // A blocks B while B blocks A would leave both stuck; refuse the cycle of two.
      const [reverse] = await tx.db
        .select({ id: taskRelations.id })
        .from(taskRelations)
        .where(
          and(
            eq(taskRelations.organizationId, tx.organizationId),
            eq(taskRelations.type, 'blocks'),
            eq(taskRelations.sourceTaskId, target.id),
            eq(taskRelations.targetTaskId, source.id),
          ),
        )
        .limit(1);
      if (reverse) throw new InvalidReferenceError('That task already blocks this one.');
    }

    const [relation] = await tx.db
      .insert(taskRelations)
      .values({
        organizationId: tx.organizationId,
        type: input.type,
        sourceTaskId: source.id,
        targetTaskId: target.id,
        createdByMemberId: tx.memberId,
      })
      .returning({ id: taskRelations.id });

    for (const [task, otherId, direction] of [
      [source, target.id, 'outgoing'],
      [target, source.id, 'incoming'],
    ] as const) {
      await recordActivity(tx, {
        kind: 'task.related',
        projectId: task.projectId,
        taskId: task.id,
        changes: [
          { field: 'relation', from: null, to: { type: input.type, direction, taskId: otherId } },
        ],
        at: now,
      });
      await emit(tx, 'task.relations.changed', { taskId: task.id, projectId: task.projectId });
    }
    return relation ?? null;
  });
}

export function removeRelation(scope: Scope, id: string, now: Date) {
  return inTransaction(scope, async (tx) => {
    const [relation] = await tx.db
      .delete(taskRelations)
      .where(and(eq(taskRelations.organizationId, tx.organizationId), eq(taskRelations.id, id)))
      .returning();
    if (!relation) return null;
    for (const [taskId, otherId, direction] of [
      [relation.sourceTaskId, relation.targetTaskId, 'outgoing'],
      [relation.targetTaskId, relation.sourceTaskId, 'incoming'],
    ] as const) {
      const task = await liveTask(tx, taskId);
      if (!task) continue;
      await recordActivity(tx, {
        kind: 'task.unrelated',
        projectId: task.projectId,
        taskId,
        changes: [
          {
            field: 'relation',
            from: { type: relation.type, direction, taskId: otherId },
            to: null,
          },
        ],
        at: now,
      });
      await emit(tx, 'task.relations.changed', { taskId, projectId: task.projectId });
    }
    return relation;
  });
}

/** Whether a relation id belongs to a task (for authorization on removal). */
export async function findRelation(scope: Scope, id: string) {
  const [row] = await scope.db
    .select()
    .from(taskRelations)
    .where(and(eq(taskRelations.organizationId, scope.organizationId), eq(taskRelations.id, id)))
    .limit(1);
  return row ?? null;
}
