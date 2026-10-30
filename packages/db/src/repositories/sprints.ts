import { burndown, type TaskChange } from '@teamflow/domain';
import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { SprintStateError, StaleWriteError } from '../errors.ts';
import { workflowStatuses } from '../schema/projects.ts';
import { sprints } from '../schema/sprints.ts';
import { activity, tasks } from '../schema/tasks.ts';
import { inTransaction, type Scope } from '../scope.ts';
import { emit, recordActivity } from './events.ts';
import { InvalidReferenceError } from './tasks.ts';

export type SprintRow = typeof sprints.$inferSelect;

/** Raised when a sprint is asked to do something its status does not allow. */
export { SprintStateError };

const inOrg = (scope: Scope) => eq(sprints.organizationId, scope.organizationId);

export function listSprints(scope: Scope, projectId: string) {
  return scope.db
    .select()
    .from(sprints)
    .where(and(inOrg(scope), eq(sprints.projectId, projectId)))
    .orderBy(asc(sprints.startsAt));
}

export async function findSprint(
  scope: Scope,
  id: string,
  { lock = false } = {},
): Promise<SprintRow | null> {
  const query = scope.db
    .select()
    .from(sprints)
    .where(and(inOrg(scope), eq(sprints.id, id)))
    .limit(1);
  const [row] = await (lock ? query.for('update') : query);
  return row ?? null;
}

export function createSprint(
  scope: Scope,
  input: { projectId: string; name: string; goal?: string; startsAt: Date; endsAt: Date },
) {
  return inTransaction(scope, async (tx) => {
    const [sprint] = await tx.db
      .insert(sprints)
      .values({ organizationId: tx.organizationId, ...input })
      .returning();
    if (!sprint) throw new Error('insert returned no row');
    await recordActivity(tx, { kind: 'sprint.created', projectId: sprint.projectId });
    await emit(tx, 'sprint.changed', {
      sprintId: sprint.id,
      projectId: sprint.projectId,
      version: sprint.version,
    });
    return sprint;
  });
}

async function lockSprint(tx: Scope, id: string, expectedVersion: number) {
  const [current] = await tx.db
    .select()
    .from(sprints)
    .where(and(inOrg(tx), eq(sprints.id, id)))
    .for('update')
    .limit(1);
  if (!current) return null;
  if (current.version !== expectedVersion) throw new StaleWriteError(current.version);
  return current;
}

async function save(tx: Scope, current: SprintRow, patch: Partial<SprintRow>, kind: string) {
  const [sprint] = await tx.db
    .update(sprints)
    .set({ ...patch, version: sql`${sprints.version} + 1` })
    .where(and(inOrg(tx), eq(sprints.id, current.id)))
    .returning();
  if (!sprint) throw new Error('update returned no row');
  await recordActivity(tx, { kind, projectId: sprint.projectId });
  await emit(tx, 'sprint.changed', {
    sprintId: sprint.id,
    projectId: sprint.projectId,
    version: sprint.version,
  });
  return sprint;
}

export function updateSprint(
  scope: Scope,
  id: string,
  expectedVersion: number,
  patch: { name?: string; goal?: string; startsAt?: Date; endsAt?: Date },
) {
  return inTransaction(scope, async (tx) => {
    const current = await lockSprint(tx, id, expectedVersion);
    if (!current) return null;
    if (current.status === 'completed')
      throw new SprintStateError('A completed sprint cannot be edited.');
    // The create schema checks the order of the dates; a patch may move only one of them.
    const startsAt = patch.startsAt ?? current.startsAt;
    const endsAt = patch.endsAt ?? current.endsAt;
    if (endsAt <= startsAt) throw new SprintStateError('A sprint has to end after it starts.');
    return save(tx, current, patch, 'sprint.updated');
  });
}

/** Start a planned sprint. The partial unique index guarantees at most one active sprint per project. */
export function startSprint(scope: Scope, id: string, expectedVersion: number, now: Date) {
  return inTransaction(scope, async (tx) => {
    const current = await lockSprint(tx, id, expectedVersion);
    if (!current) return null;
    if (current.status !== 'planned')
      throw new SprintStateError('Only a planned sprint can be started.');
    return save(tx, current, { status: 'active', startedAt: now }, 'sprint.started');
  });
}

/**
 * Everything that happened to tasks that were ever in this sprint, as metric input. One query for the task ids,
 * one for their history.
 */
export async function sprintChanges(scope: Scope, sprintId: string): Promise<TaskChange[]> {
  const ever = await scope.db.execute<{ task_id: string }>(sql`
    select distinct task_id from activity
    where organization_id = ${scope.organizationId}
      and task_id is not null
      and changes @> ${JSON.stringify([{ field: 'sprintId', to: sprintId }])}::jsonb
  `);
  const ids = ever.map((r) => r.task_id);
  if (ids.length === 0) return [];
  const rows = await scope.db
    .select({
      taskId: activity.taskId,
      kind: activity.kind,
      changes: activity.changes,
      at: activity.createdAt,
    })
    .from(activity)
    .where(and(eq(activity.organizationId, scope.organizationId), inArray(activity.taskId, ids)))
    .orderBy(asc(activity.createdAt), asc(activity.id));

  const changes: TaskChange[] = [];
  const firstSeen = new Map<string, Date>();
  const seeded = new Map<string, Set<string>>();
  const firstFrom = new Map<string, Map<string, unknown>>();
  for (const row of rows) {
    if (!row.taskId) continue;
    if (!firstSeen.has(row.taskId)) firstSeen.set(row.taskId, row.at);
    if (row.kind === 'task.deleted')
      changes.push({ taskId: row.taskId, at: row.at, field: 'deleted', to: true });
    for (const change of row.changes) {
      if (change.field !== 'status' && change.field !== 'sprintId' && change.field !== 'estimate')
        continue;
      const fields = seeded.get(row.taskId) ?? new Set();
      if (!fields.has(change.field)) {
        fields.add(change.field);
        seeded.set(row.taskId, fields);
        const froms = firstFrom.get(row.taskId) ?? new Map();
        froms.set(change.field, change.from);
        firstFrom.set(row.taskId, froms);
      }
      changes.push({ taskId: row.taskId, at: row.at, field: change.field, to: change.to });
    }
  }

  // Histories written before creation recorded every field (or imported without it) start with a gap. Seed the
  // estimate from the first change's "from", or else from the task's current value, at the task's first entry.
  const current = await scope.db
    .select({ id: tasks.id, estimate: tasks.estimate })
    .from(tasks)
    .where(and(eq(tasks.organizationId, scope.organizationId), inArray(tasks.id, ids)));
  const seeds: TaskChange[] = [];
  for (const task of current) {
    const at = firstSeen.get(task.id);
    if (!at) continue;
    const firstEstimate = firstFrom.get(task.id)?.get('estimate');
    if (firstEstimate === null) continue; // the history starts with an explicit "no estimate"
    seeds.push({
      taskId: task.id,
      at,
      field: 'estimate',
      to: firstEstimate === undefined ? task.estimate : firstEstimate,
    });
  }
  // Seeds go first so a recorded value at the same instant wins.
  return [...seeds, ...changes].sort((a, b) => a.at.getTime() - b.at.getTime());
}

/**
 * Complete an active sprint: freeze its committed and completed points, and carry its unfinished tasks to
 * another planned sprint of the same project — or back to the backlog with `null`.
 */
export function completeSprint(
  scope: Scope,
  id: string,
  expectedVersion: number,
  carryOverTo: string | null,
  now: Date,
) {
  return inTransaction(scope, async (tx) => {
    // Both sprints are locked before any task, and in id order, the same order a task write takes them in.
    const early =
      carryOverTo && carryOverTo < id
        ? await findSprint(tx, carryOverTo, { lock: true })
        : undefined;
    const current = await lockSprint(tx, id, expectedVersion);
    if (!current) return null;
    if (current.status !== 'active')
      throw new SprintStateError('Only the active sprint can be completed.');
    if (carryOverTo) {
      // Locked, so it cannot be started or completed while unfinished work is moved into it.
      const target =
        early !== undefined ? early : await findSprint(tx, carryOverTo, { lock: true });
      if (!target || target.projectId !== current.projectId || target.status !== 'planned') {
        throw new InvalidReferenceError(
          'Unfinished work can only move to a planned sprint of this project.',
        );
      }
    }

    const result = burndown(id, await sprintChanges(tx, id), {
      startsAt: current.startedAt ?? current.startsAt,
      endsAt: now,
      now,
    });
    const final = result.days.at(-1);
    const committedPoints = result.committed.totalPoints;
    const completedPoints = final ? final.totalPoints - final.remainingPoints : 0;

    const open = await tx.db
      .select({ id: tasks.id, projectId: tasks.projectId })
      .from(tasks)
      .innerJoin(
        workflowStatuses,
        and(
          eq(workflowStatuses.organizationId, tasks.organizationId),
          eq(workflowStatuses.id, tasks.statusId),
        ),
      )
      .where(
        and(
          eq(tasks.organizationId, tx.organizationId),
          eq(tasks.sprintId, id),
          isNull(tasks.deletedAt),
          sql`${workflowStatuses.category} not in ('completed', 'canceled')`,
        ),
      )
      .for('update', { of: tasks });

    if (open.length > 0) {
      await tx.db
        .update(tasks)
        .set({ sprintId: carryOverTo, version: sql`${tasks.version} + 1` })
        .where(
          and(
            eq(tasks.organizationId, tx.organizationId),
            inArray(
              tasks.id,
              open.map((t) => t.id),
            ),
          ),
        );
      for (const task of open) {
        await recordActivity(tx, {
          kind: 'task.updated',
          projectId: task.projectId,
          taskId: task.id,
          changes: [{ field: 'sprintId', from: id, to: carryOverTo }],
          at: now,
        });
      }
      await emit(tx, 'sprint.carried_over', {
        sprintId: id,
        projectId: current.projectId,
        moved: open.length,
      });
    }

    return save(
      tx,
      current,
      { status: 'completed', completedAt: now, committedPoints, completedPoints },
      'sprint.completed',
    );
  });
}

/** Completed sprints of a project, oldest first, for velocity. */
export function completedSprints(scope: Scope, projectId: string, limit = 12) {
  return scope.db
    .select()
    .from(sprints)
    .where(and(inOrg(scope), eq(sprints.projectId, projectId), eq(sprints.status, 'completed')))
    .orderBy(desc(sprints.completedAt))
    .limit(limit)
    .then((rows) => rows.reverse());
}
