import {
  nextLifecycle,
  type Priority,
  type Rank,
  rankBetween,
  type StatusCategory,
} from '@teamflow/domain';
import { and, asc, desc, eq, gt, inArray, isNull, lt, ne, or, sql } from 'drizzle-orm';
import { StaleWriteError } from '../errors.ts';
import { labels, projects, workflowStatuses } from '../schema/projects.ts';
import { activity, type FieldChange, taskLabels, tasks } from '../schema/tasks.ts';
import { inTransaction, type Scope } from '../scope.ts';
import { diff, emit, recordActivity } from './events.ts';

export type TaskRow = typeof tasks.$inferSelect;
export type TaskWithLabels = TaskRow & { labelIds: string[] };

/** Thrown when input names something that exists but does not fit (a status of another project, …). */
export class InvalidReferenceError extends Error {
  override name = 'InvalidReferenceError';
}

const live = (scope: Scope) =>
  and(eq(tasks.organizationId, scope.organizationId), isNull(tasks.deletedAt));

async function attachLabels(scope: Scope, rows: TaskRow[]): Promise<TaskWithLabels[]> {
  if (rows.length === 0) return [];
  const links = await scope.db
    .select({ taskId: taskLabels.taskId, labelId: taskLabels.labelId })
    .from(taskLabels)
    .where(
      and(
        eq(taskLabels.organizationId, scope.organizationId),
        inArray(
          taskLabels.taskId,
          rows.map((r) => r.id),
        ),
      ),
    );
  const byTask = new Map<string, string[]>();
  for (const link of links)
    byTask.set(link.taskId, [...(byTask.get(link.taskId) ?? []), link.labelId]);
  return rows.map((row) => ({ ...row, labelIds: (byTask.get(row.id) ?? []).sort() }));
}

export interface TaskFilter {
  projectId: string;
  statusIds?: string[] | undefined;
  assigneeMemberId?: string | null | undefined;
  parentTaskId?: string | undefined;
}

/** Live tasks of a project in board order: by status column, then rank. */
export async function listTasks(scope: Scope, filter: TaskFilter): Promise<TaskWithLabels[]> {
  const rows = await scope.db
    .select()
    .from(tasks)
    .where(
      and(
        live(scope),
        eq(tasks.projectId, filter.projectId),
        filter.statusIds?.length ? inArray(tasks.statusId, filter.statusIds) : undefined,
        filter.assigneeMemberId === null
          ? isNull(tasks.assigneeMemberId)
          : filter.assigneeMemberId
            ? eq(tasks.assigneeMemberId, filter.assigneeMemberId)
            : undefined,
        filter.parentTaskId ? eq(tasks.parentTaskId, filter.parentTaskId) : undefined,
      ),
    )
    .orderBy(asc(tasks.statusId), asc(tasks.rank));
  return attachLabels(scope, rows);
}

export async function findTask(scope: Scope, id: string): Promise<TaskWithLabels | null> {
  const [row] = await scope.db
    .select()
    .from(tasks)
    .where(and(live(scope), eq(tasks.id, id)))
    .limit(1);
  if (!row) return null;
  const [withLabels] = await attachLabels(scope, [row]);
  return withLabels ?? null;
}

export async function findTaskByNumber(
  scope: Scope,
  projectKey: string,
  number: number,
): Promise<TaskWithLabels | null> {
  const [row] = await scope.db
    .select({ task: tasks })
    .from(tasks)
    .innerJoin(
      projects,
      and(eq(projects.organizationId, tasks.organizationId), eq(projects.id, tasks.projectId)),
    )
    .where(and(live(scope), eq(projects.key, projectKey), eq(tasks.number, number)))
    .limit(1);
  if (!row) return null;
  const [withLabels] = await attachLabels(scope, [row.task]);
  return withLabels ?? null;
}

async function statusOf(scope: Scope, projectId: string, statusId: string) {
  const [status] = await scope.db
    .select({ id: workflowStatuses.id, category: workflowStatuses.category })
    .from(workflowStatuses)
    .where(
      and(
        eq(workflowStatuses.organizationId, scope.organizationId),
        eq(workflowStatuses.projectId, projectId),
        eq(workflowStatuses.id, statusId),
      ),
    )
    .limit(1);
  if (!status)
    throw new InvalidReferenceError('That status is not part of this project’s workflow.');
  return status;
}

/** The first status of the first `unstarted` category: where new work lands by default. */
async function defaultStatus(scope: Scope, projectId: string) {
  const [status] = await scope.db
    .select({ id: workflowStatuses.id, category: workflowStatuses.category })
    .from(workflowStatuses)
    .where(
      and(
        eq(workflowStatuses.organizationId, scope.organizationId),
        eq(workflowStatuses.projectId, projectId),
      ),
    )
    .orderBy(
      sql`case ${workflowStatuses.category} when 'unstarted' then 0 when 'backlog' then 1 else 2 end`,
      asc(workflowStatuses.rank),
    )
    .limit(1);
  if (!status) throw new InvalidReferenceError('This project has no workflow.');
  return status;
}

async function assertLabels(scope: Scope, projectId: string, labelIds: string[]) {
  if (labelIds.length === 0) return;
  const found = await scope.db
    .select({ id: labels.id })
    .from(labels)
    .where(
      and(
        eq(labels.organizationId, scope.organizationId),
        inArray(labels.id, labelIds),
        or(isNull(labels.projectId), eq(labels.projectId, projectId)),
      ),
    );
  if (found.length !== new Set(labelIds).size) {
    throw new InvalidReferenceError('A label does not exist or belongs to another project.');
  }
}

async function assertParent(
  scope: Scope,
  projectId: string,
  parentTaskId: string,
  taskId?: string,
) {
  if (parentTaskId === taskId) throw new InvalidReferenceError('A task cannot be its own parent.');
  // Walk up from the new parent; finding the task itself would create a cycle.
  const chain = await scope.db.execute<{ id: string; project_id: string }>(sql`
    with recursive up(id, parent_task_id, project_id, depth) as (
      select id, parent_task_id, project_id, 0 from tasks
      where organization_id = ${scope.organizationId} and id = ${parentTaskId} and deleted_at is null
      union all
      select t.id, t.parent_task_id, t.project_id, up.depth + 1 from tasks t
      join up on t.id = up.parent_task_id and t.organization_id = ${scope.organizationId}
      where up.depth < 50
    )
    select id, project_id from up
  `);
  const parent = chain[0];
  if (!parent || parent.project_id !== projectId) {
    throw new InvalidReferenceError('The parent task must be a task in the same project.');
  }
  if (taskId && chain.some((row) => row.id === taskId)) {
    throw new InvalidReferenceError('That would make the task a parent of itself.');
  }
}

async function replaceLabels(scope: Scope, taskId: string, labelIds: string[]) {
  await scope.db
    .delete(taskLabels)
    .where(and(eq(taskLabels.organizationId, scope.organizationId), eq(taskLabels.taskId, taskId)));
  if (labelIds.length > 0) {
    await scope.db.insert(taskLabels).values(
      [...new Set(labelIds)].map((labelId) => ({
        organizationId: scope.organizationId,
        taskId,
        labelId,
      })),
    );
  }
}

/** Rank for a task placed between two neighbours (by id) in a column; `null` means the end of the column. */
async function rankFor(
  scope: Scope,
  statusId: string,
  place: { afterId?: string | null | undefined; beforeId?: string | null | undefined },
  /** The task being moved, which must not count as its own neighbour. */
  movingId?: string,
): Promise<Rank> {
  const neighbour = async (id: string) => {
    const [row] = await scope.db
      .select({ rank: tasks.rank, statusId: tasks.statusId })
      .from(tasks)
      .where(and(live(scope), eq(tasks.id, id)))
      .limit(1);
    if (!row || row.statusId !== statusId) {
      throw new InvalidReferenceError('A neighbouring task is not in the target column.');
    }
    return row.rank;
  };
  const column = and(
    live(scope),
    eq(tasks.statusId, statusId),
    movingId ? ne(tasks.id, movingId) : undefined,
  );

  const after: Rank | null = place.afterId ? await neighbour(place.afterId) : null;
  const before: Rank | null = place.beforeId ? await neighbour(place.beforeId) : null;
  const edge = async (direction: 'first' | 'last', bound?: { gt?: Rank; lt?: Rank }) => {
    const [row] = await scope.db
      .select({ rank: tasks.rank })
      .from(tasks)
      .where(
        and(
          column,
          bound?.gt !== undefined ? gt(tasks.rank, bound.gt) : undefined,
          bound?.lt !== undefined ? lt(tasks.rank, bound.lt) : undefined,
        ),
      )
      .orderBy(direction === 'first' ? asc(tasks.rank) : desc(tasks.rank))
      .limit(1);
    return row?.rank ?? null;
  };

  // `undefined` means "not specified, use whatever is there"; `null` means "the edge of the column".
  let low = after;
  let high = before;
  if (place.afterId && place.beforeId === undefined)
    high = await edge('first', { gt: after ?? '' });
  else if (place.beforeId && place.afterId === undefined)
    low = await edge('last', { lt: before ?? '' });
  else if (place.afterId === null && place.beforeId === undefined) high = await edge('first');
  else if (!place.afterId && !place.beforeId) low = await edge('last');

  if (low !== null && high !== null && low >= high) {
    throw new InvalidReferenceError('The neighbouring tasks are not adjacent in that order.');
  }
  return rankBetween(low, high);
}

export interface CreateTaskInput {
  id?: string | undefined;
  projectId: string;
  title: string;
  description?: string | undefined;
  statusId?: string | undefined;
  priority?: Priority | undefined;
  estimate?: number | null | undefined;
  assigneeMemberId?: string | null | undefined;
  parentTaskId?: string | null | undefined;
  sprintId?: string | null | undefined;
  dueDate?: string | null | undefined;
  labelIds?: string[] | undefined;
}

export function createTask(scope: Scope, input: CreateTaskInput, now: Date) {
  return inTransaction(scope, async (tx) => {
    // Allocating the number locks the project row, serialising concurrent creates in this project only.
    const [allocated] = await tx.db
      .update(projects)
      .set({ taskSequence: sql`${projects.taskSequence} + 1` })
      .where(
        and(
          eq(projects.organizationId, tx.organizationId),
          eq(projects.id, input.projectId),
          isNull(projects.archivedAt),
        ),
      )
      .returning({ number: projects.taskSequence });
    if (!allocated) return null;

    const status = input.statusId
      ? await statusOf(tx, input.projectId, input.statusId)
      : await defaultStatus(tx, input.projectId);
    if (input.labelIds) await assertLabels(tx, input.projectId, input.labelIds);
    if (input.parentTaskId) await assertParent(tx, input.projectId, input.parentTaskId);

    const lifecycle = nextLifecycle(
      { startedAt: null, completedAt: null, canceledAt: null },
      status.category,
      now,
    );
    const [task] = await tx.db
      .insert(tasks)
      .values({
        ...(input.id ? { id: input.id } : {}),
        organizationId: tx.organizationId,
        projectId: input.projectId,
        number: allocated.number,
        title: input.title,
        description: input.description ?? '',
        statusId: status.id,
        priority: input.priority ?? 'none',
        estimate: input.estimate ?? null,
        assigneeMemberId: input.assigneeMemberId ?? null,
        parentTaskId: input.parentTaskId ?? null,
        sprintId: input.sprintId ?? null,
        dueDate: input.dueDate ?? null,
        rank: await rankFor(tx, status.id, {}),
        createdByMemberId: tx.memberId,
        ...lifecycle,
      })
      .returning();
    if (!task) throw new Error('insert returned no row');
    if (input.labelIds) await replaceLabels(tx, task.id, input.labelIds);

    await recordActivity(tx, {
      at: now,
      kind: 'task.created',
      projectId: task.projectId,
      taskId: task.id,
      // The initial values metrics replay from (docs/ADR-0007).
      changes: [
        { field: 'status', from: null, to: { id: status.id, category: status.category } },
        { field: 'sprintId', from: null, to: task.sprintId },
        { field: 'estimate', from: null, to: task.estimate },
      ],
    });
    await emit(tx, 'task.created', {
      taskId: task.id,
      projectId: task.projectId,
      version: task.version,
    });
    return { ...task, labelIds: [...new Set(input.labelIds ?? [])].sort() };
  });
}

export interface TaskPatch {
  title?: string;
  description?: string;
  priority?: Priority;
  estimate?: number | null;
  assigneeMemberId?: string | null;
  parentTaskId?: string | null;
  sprintId?: string | null;
  dueDate?: string | null;
  statusId?: string;
  labelIds?: string[];
}

const TRACKED = [
  'title',
  'description',
  'priority',
  'estimate',
  'assigneeMemberId',
  'parentTaskId',
  'sprintId',
  'dueDate',
] as const;

/** Lock a live task and check its version. */
async function lockTask(tx: Scope, id: string, expectedVersion: number) {
  const [current] = await tx.db
    .select()
    .from(tasks)
    .where(and(live(tx), eq(tasks.id, id)))
    .for('update')
    .limit(1);
  if (!current) return null;
  if (current.version !== expectedVersion) throw new StaleWriteError(current.version);
  return current;
}

async function currentLabels(tx: Scope, taskId: string) {
  const rows = await tx.db
    .select({ labelId: taskLabels.labelId })
    .from(taskLabels)
    .where(and(eq(taskLabels.organizationId, tx.organizationId), eq(taskLabels.taskId, taskId)));
  return rows.map((r) => r.labelId).sort();
}

interface StatusMove {
  statusId: string;
  rank: Rank;
}

async function applyChange(
  tx: Scope,
  current: TaskRow,
  patch: Omit<TaskPatch, 'statusId'>,
  move: StatusMove | null,
  now: Date,
  kind: string,
): Promise<TaskWithLabels> {
  const changes: FieldChange[] = [];
  let lifecycle = {};
  if (move && move.statusId !== current.statusId) {
    const [from, to] = await Promise.all([
      statusOf(tx, current.projectId, current.statusId),
      statusOf(tx, current.projectId, move.statusId),
    ]);
    lifecycle = nextLifecycle(current, to.category as StatusCategory, now);
    changes.push({
      field: 'status',
      from: { id: from.id, category: from.category },
      to: { id: to.id, category: to.category },
    });
  }

  const { labelIds: nextLabelIds, ...columns } = patch;
  const [updated] = await tx.db
    .update(tasks)
    .set({
      ...columns,
      ...(move ? { statusId: move.statusId, rank: move.rank } : {}),
      ...lifecycle,
      version: sql`${tasks.version} + 1`,
    })
    .where(and(eq(tasks.organizationId, tx.organizationId), eq(tasks.id, current.id)))
    .returning();
  if (!updated) throw new Error('update returned no row');

  changes.push(...diff(current, updated, TRACKED));

  let labelIds = await currentLabels(tx, current.id);
  if (nextLabelIds) {
    const next = [...new Set(nextLabelIds)].sort();
    if (next.join() !== labelIds.join()) {
      await replaceLabels(tx, current.id, next);
      changes.push({ field: 'labelIds', from: labelIds, to: next });
      labelIds = next;
    }
  }

  // A reorder inside one column changes nothing worth a history line, but others still need to see it.
  if (changes.length > 0) {
    await recordActivity(tx, {
      kind,
      projectId: updated.projectId,
      taskId: updated.id,
      changes,
      at: now,
    });
  }
  await emit(tx, kind, {
    taskId: updated.id,
    projectId: updated.projectId,
    version: updated.version,
  });
  return { ...updated, labelIds };
}

export function updateTask(
  scope: Scope,
  id: string,
  expectedVersion: number,
  patch: TaskPatch,
  now: Date,
) {
  return inTransaction(scope, async (tx) => {
    const current = await lockTask(tx, id, expectedVersion);
    if (!current) return null;
    const { statusId, labelIds, ...fields } = patch;
    if (labelIds) await assertLabels(tx, current.projectId, labelIds);
    if (fields.parentTaskId)
      await assertParent(tx, current.projectId, fields.parentTaskId, current.id);
    const move =
      statusId && statusId !== current.statusId
        ? {
            statusId,
            rank: await rankFor(tx, (await statusOf(tx, current.projectId, statusId)).id, {}, id),
          }
        : null;
    return applyChange(
      tx,
      current,
      labelIds ? { ...fields, labelIds } : fields,
      move,
      now,
      'task.updated',
    );
  });
}

export interface MoveInput {
  statusId: string;
  afterId?: string | null | undefined;
  beforeId?: string | null | undefined;
}

/** Drag and drop: put a task into a column between two neighbours. */
export function moveTask(
  scope: Scope,
  id: string,
  expectedVersion: number,
  input: MoveInput,
  now: Date,
) {
  return inTransaction(scope, async (tx) => {
    const current = await lockTask(tx, id, expectedVersion);
    if (!current) return null;
    if (input.afterId === id || input.beforeId === id) {
      throw new InvalidReferenceError('A task cannot be placed next to itself.');
    }
    await statusOf(tx, current.projectId, input.statusId);
    const rank = await rankFor(tx, input.statusId, input, id);
    return applyChange(tx, current, {}, { statusId: input.statusId, rank }, now, 'task.moved');
  });
}

export function deleteTask(scope: Scope, id: string, expectedVersion: number, now: Date) {
  return inTransaction(scope, async (tx) => {
    const current = await lockTask(tx, id, expectedVersion);
    if (!current) return null;
    await tx.db
      .update(tasks)
      .set({ deletedAt: now, version: sql`${tasks.version} + 1` })
      .where(and(eq(tasks.organizationId, tx.organizationId), eq(tasks.id, id)));
    await recordActivity(tx, {
      kind: 'task.deleted',
      projectId: current.projectId,
      taskId: id,
      at: now,
    });
    await emit(tx, 'task.deleted', {
      taskId: id,
      projectId: current.projectId,
      version: current.version + 1,
    });
    return true;
  });
}

export function taskHistory(scope: Scope, taskId: string) {
  return scope.db
    .select()
    .from(activity)
    .where(and(eq(activity.organizationId, scope.organizationId), eq(activity.taskId, taskId)))
    .orderBy(asc(activity.createdAt), asc(activity.id));
}
