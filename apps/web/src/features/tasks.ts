import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Outputs } from '@teamflow/contract';
import { type Rank, rankBetween } from '@teamflow/domain';
import { toast } from '@teamflow/ui';
import { client, orpc } from '../lib/api.ts';

export type Task = Outputs['tasks']['list'][number];
export type Project = Outputs['projects']['get'];

export const tasksQuery = (projectId: string) =>
  orpc.tasks.list.queryOptions({ input: { projectId } });

export const byRank = (a: Task, b: Task) => (a.rank < b.rank ? -1 : a.rank > b.rank ? 1 : 0);

export interface Placement {
  statusId: string;
  /** Put it after this task; `null` = top of the column; omitted = decided by `beforeId` or end of column. */
  afterId?: string | null;
  beforeId?: string | null;
}

/** The rank the server will compute for a placement, computed locally so the card moves before it answers. */
export function rankFor(tasks: readonly Task[], movingId: string, place: Placement): Rank {
  const column = tasks
    .filter((t) => t.statusId === place.statusId && t.id !== movingId)
    .sort(byRank);
  const index = (id: string) => column.findIndex((t) => t.id === id);
  let low: Rank | null = null;
  let high: Rank | null = null;
  if (place.afterId) {
    const i = index(place.afterId);
    low = column[i]?.rank ?? null;
    high = place.beforeId
      ? (column[index(place.beforeId)]?.rank ?? null)
      : (column[i + 1]?.rank ?? null);
  } else if (place.beforeId) {
    const i = index(place.beforeId);
    high = column[i]?.rank ?? null;
    low = place.afterId === null ? null : (column[i - 1]?.rank ?? null);
  } else if (place.afterId === null) {
    high = column[0]?.rank ?? null;
  } else {
    low = column.at(-1)?.rank ?? null;
  }
  return rankBetween(low, high);
}

const explain = (error: unknown) =>
  (error as { code?: string }).code === 'CONFLICT'
    ? 'Someone changed this task at the same time. The board has been refreshed.'
    : 'The change was not saved. Check your connection and try again.';

/**
 * Move a task on the board, optimistically. Moves of the same task run one after another (mutation scope), and
 * each reads the task's latest version from the cache when it runs, so quick successive drags do not conflict
 * with each other.
 */
export function useMoveTask(projectId: string) {
  const queryClient = useQueryClient();
  const queryKey = tasksQuery(projectId).queryKey;
  const current = (id: string) => queryClient.getQueryData(queryKey)?.find((t) => t.id === id);

  return useMutation({
    mutationKey: ['tasks', 'move'],
    scope: { id: `project-${projectId}-writes` },
    mutationFn: ({ id, place }: { id: string; place: Placement }) => {
      const task = current(id);
      if (!task) throw new Error('task not in cache');
      return client.tasks.move({ id, version: task.version, ...place });
    },
    onMutate: async ({ id, place }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData(queryKey);
      if (previous) {
        const rank = rankFor(previous, id, place);
        queryClient.setQueryData(
          queryKey,
          previous.map((t) => (t.id === id ? { ...t, statusId: place.statusId, rank } : t)),
        );
      }
      return { previous };
    },
    onSuccess: (task) => {
      queryClient.setQueryData(queryKey, (tasks) =>
        tasks?.map((t) => (t.id === task.id ? task : t)),
      );
    },
    onError: (error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
      toast({ title: 'Move not saved', description: explain(error), tone: 'danger' });
      void queryClient.invalidateQueries({ queryKey });
    },
  });
}

/** Create a task at the bottom of a column; it appears immediately with a provisional number. */
export function useCreateTask(project: Project) {
  const queryClient = useQueryClient();
  const queryKey = tasksQuery(project.id).queryKey;

  return useMutation({
    mutationFn: (input: {
      id: string;
      title: string;
      statusId: string;
      sprintId?: string | null;
      parentTaskId?: string | null;
    }) => client.tasks.create({ ...input, projectId: project.id }),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData(queryKey) ?? [];
      const now = new Date();
      const draft: Task = {
        id: input.id,
        projectId: project.id,
        number: 0,
        identifier: `${project.key}-…`,
        title: input.title,
        description: '',
        statusId: input.statusId,
        priority: 'none',
        estimate: null,
        assigneeMemberId: null,
        parentTaskId: input.parentTaskId ?? null,
        sprintId: input.sprintId ?? null,
        dueDate: null,
        rank: rankFor(previous, input.id, { statusId: input.statusId }),
        labelIds: [],
        startedAt: null,
        completedAt: null,
        canceledAt: null,
        createdByMemberId: null,
        version: 1,
        createdAt: now,
        updatedAt: now,
      };
      queryClient.setQueryData(queryKey, [...previous, draft]);
      return { previous };
    },
    onSuccess: (task) => {
      queryClient.setQueryData(queryKey, (tasks) =>
        tasks?.map((t) => (t.id === task.id ? task : t)),
      );
    },
    onError: (_error, _input, context) => {
      if (context) queryClient.setQueryData(queryKey, context.previous);
      toast({
        title: 'Task not created',
        description: 'Check your connection and try again.',
        tone: 'danger',
      });
    },
  });
}

export type TaskPatch = Partial<
  Pick<
    Task,
    | 'title'
    | 'description'
    | 'statusId'
    | 'priority'
    | 'estimate'
    | 'assigneeMemberId'
    | 'dueDate'
    | 'labelIds'
    | 'sprintId'
  >
>;

/**
 * Patch a task optimistically. Shares the move queue, so an edit and a drag of the same task never race each
 * other's version.
 */
export function useUpdateTask(projectId: string) {
  const queryClient = useQueryClient();
  const queryKey = tasksQuery(projectId).queryKey;
  const current = (id: string) => queryClient.getQueryData(queryKey)?.find((t) => t.id === id);

  return useMutation({
    mutationKey: ['tasks', 'update'],
    scope: { id: `project-${projectId}-writes` },
    mutationFn: ({ id, patch }: { id: string; patch: TaskPatch }) => {
      const task = current(id);
      if (!task) throw new Error('task not in cache');
      return client.tasks.update({ id, version: task.version, ...patch });
    },
    onMutate: async ({ id, patch }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData(queryKey);
      queryClient.setQueryData(queryKey, (tasks) =>
        tasks?.map((t) => (t.id === id ? { ...t, ...patch } : t)),
      );
      return { previous };
    },
    onSuccess: (task) => {
      queryClient.setQueryData(queryKey, (tasks) =>
        tasks?.map((t) => (t.id === task.id ? task : t)),
      );
      void queryClient.invalidateQueries({
        queryKey: orpc.tasks.history.key({ input: { id: task.id } }),
      });
    },
    onError: (error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
      toast({ title: 'Change not saved', description: explain(error), tone: 'danger' });
      void queryClient.invalidateQueries({ queryKey });
    },
  });
}
