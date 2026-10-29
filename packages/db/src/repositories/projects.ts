import { DEFAULT_WORKFLOW, ranksBetween } from '@teamflow/domain';
import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import { StaleWriteError } from '../errors.ts';
import { projects, workflowStatuses } from '../schema/projects.ts';
import { inTransaction, type Scope } from '../scope.ts';
import { diff, emit, recordActivity } from './events.ts';

export type ProjectRow = typeof projects.$inferSelect;
export type WorkflowStatusRow = typeof workflowStatuses.$inferSelect;

const inOrg = (scope: Scope) => eq(projects.organizationId, scope.organizationId);

export function listProjects(scope: Scope, { includeArchived = false } = {}) {
  return scope.db
    .select()
    .from(projects)
    .where(and(inOrg(scope), includeArchived ? undefined : isNull(projects.archivedAt)))
    .orderBy(asc(projects.name));
}

export async function findProject(scope: Scope, id: string): Promise<ProjectRow | null> {
  const [row] = await scope.db
    .select()
    .from(projects)
    .where(and(inOrg(scope), eq(projects.id, id)))
    .limit(1);
  return row ?? null;
}

export async function findProjectByKey(scope: Scope, key: string): Promise<ProjectRow | null> {
  const [row] = await scope.db
    .select()
    .from(projects)
    .where(and(inOrg(scope), eq(projects.key, key)))
    .limit(1);
  return row ?? null;
}

export function listStatuses(scope: Scope, projectId: string) {
  return scope.db
    .select()
    .from(workflowStatuses)
    .where(
      and(
        eq(workflowStatuses.organizationId, scope.organizationId),
        eq(workflowStatuses.projectId, projectId),
      ),
    )
    .orderBy(asc(workflowStatuses.rank));
}

export interface CreateProjectInput {
  key: string;
  name: string;
  description?: string;
  color?: string;
  leadMemberId?: string | null;
}

/** Create a project with the default workflow. */
export function createProject(scope: Scope, input: CreateProjectInput) {
  return inTransaction(scope, async (tx) => {
    const [project] = await tx.db
      .insert(projects)
      .values({
        organizationId: tx.organizationId,
        key: input.key,
        name: input.name,
        description: input.description ?? '',
        ...(input.color ? { color: input.color } : {}),
        leadMemberId: input.leadMemberId ?? null,
        createdByMemberId: tx.memberId,
      })
      .returning();
    if (!project) throw new Error('insert returned no row');

    const ranks = ranksBetween(null, null, DEFAULT_WORKFLOW.length, { jitter: 0 });
    const statuses = await tx.db
      .insert(workflowStatuses)
      .values(
        DEFAULT_WORKFLOW.map((status, i) => ({
          organizationId: tx.organizationId,
          projectId: project.id,
          name: status.name,
          category: status.category,
          color: status.color,
          rank: ranks[i] ?? 'a0',
        })),
      )
      .returning();

    await recordActivity(tx, { kind: 'project.created', projectId: project.id });
    await emit(tx, 'project.created', { projectId: project.id });
    return { project, statuses: statuses.sort((a, b) => (a.rank < b.rank ? -1 : 1)) };
  });
}

export type ProjectPatch = Partial<
  Pick<ProjectRow, 'name' | 'description' | 'color' | 'leadMemberId' | 'archivedAt'>
>;

const TRACKED: (keyof ProjectPatch & string)[] = [
  'name',
  'description',
  'color',
  'leadMemberId',
  'archivedAt',
];

/**
 * Apply a patch if `expectedVersion` is still current. Locks the row, so concurrent writers serialise and the
 * loser gets a `StaleWriteError` carrying the version it should reload.
 */
export function updateProject(
  scope: Scope,
  id: string,
  expectedVersion: number,
  patch: ProjectPatch,
  kind = 'project.updated',
) {
  return inTransaction(scope, async (tx) => {
    const [current] = await tx.db
      .select()
      .from(projects)
      .where(and(eq(projects.organizationId, tx.organizationId), eq(projects.id, id)))
      .for('update')
      .limit(1);
    if (!current) return null;
    if (current.version !== expectedVersion) throw new StaleWriteError(current.version);
    // Saving what is already there is not a change: bumping the version would make everyone else's next write
    // a conflict for nothing.
    const same = (Object.keys(patch) as (keyof ProjectPatch)[]).every(
      (key) => JSON.stringify(patch[key]) === JSON.stringify(current[key]),
    );
    if (same) return current;

    const [updated] = await tx.db
      .update(projects)
      .set({ ...patch, version: sql`${projects.version} + 1` })
      .where(and(eq(projects.organizationId, tx.organizationId), eq(projects.id, id)))
      .returning();
    if (!updated) return null;

    const changes = diff(current, updated, TRACKED);
    if (changes.length > 0) {
      await recordActivity(tx, { kind, projectId: id, changes });
      await emit(tx, kind, { projectId: id, version: updated.version });
    }
    return updated;
  });
}
