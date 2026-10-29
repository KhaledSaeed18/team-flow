import { useQueryClient } from '@tanstack/react-query';
import type { DomainEvent } from '@teamflow/realtime';
import { projectChannel } from '@teamflow/realtime';
import { useEffect } from 'react';
import { client, orpc } from '../lib/api.ts';
import { realtime, useChannel } from '../lib/realtime.ts';
import { type Project, tasksQuery } from './tasks.ts';

/**
 * Keep a project's cached data in step with everyone else's changes.
 *
 * Events carry ids and versions, not data. A task event whose version the cache already has (including our own
 * optimistic writes, once the server confirmed them) is ignored; a newer one fetches that single task and patches
 * it into the board in place — no list refetch, no scroll jump.
 */
export function useLiveProject(project: Project) {
  const queryClient = useQueryClient();
  const tasksKey = tasksQuery(project.id).queryKey;

  const patchTask = async (taskId: string, version: number) => {
    const cached = queryClient.getQueryData(tasksKey)?.find((t) => t.id === taskId);
    if (cached && cached.version >= version) return;
    try {
      const task = await client.tasks.get({ id: taskId });
      queryClient.setQueryData(tasksKey, (tasks) => {
        if (!tasks) return tasks;
        const current = tasks.find((t) => t.id === task.id);
        if (current && current.version >= task.version) return tasks;
        return current ? tasks.map((t) => (t.id === task.id ? task : t)) : [...tasks, task];
      });
    } catch {
      // Deleted or no longer visible: drop it from the board.
      queryClient.setQueryData(tasksKey, (tasks) => tasks?.filter((t) => t.id !== taskId));
    }
    void queryClient.invalidateQueries({
      queryKey: orpc.tasks.history.key({ input: { id: taskId } }),
    });
  };

  const onEvent = (event: DomainEvent) => {
    const { taskId, version } = event.payload as { taskId?: string; version?: number };
    switch (event.topic) {
      case 'task.created':
      case 'task.updated':
      case 'task.moved':
        if (taskId && typeof version === 'number') void patchTask(taskId, version);
        return;
      case 'task.deleted':
        if (taskId)
          queryClient.setQueryData(tasksKey, (tasks) => tasks?.filter((t) => t.id !== taskId));
        return;
      case 'workflow.changed':
        void queryClient.invalidateQueries({
          queryKey: orpc.projects.get.key({ input: { id: project.id } }),
        });
        void queryClient.invalidateQueries({ queryKey: tasksKey });
        return;
      case 'sprint.changed':
      case 'sprint.carried_over':
        void queryClient.invalidateQueries({ queryKey: orpc.sprints.key() });
        if (event.topic === 'sprint.carried_over')
          void queryClient.invalidateQueries({ queryKey: tasksKey });
        return;
      case 'label.changed':
      case 'label.deleted':
        void queryClient.invalidateQueries({ queryKey: orpc.labels.key() });
        return;
      default:
        if (event.topic.startsWith('project.'))
          void queryClient.invalidateQueries({ queryKey: orpc.projects.key() });
    }
  };

  useChannel(projectChannel(project.id), onEvent);

  // Anything could have happened while the socket was down: refetch rather than guess.
  useEffect(
    () =>
      realtime.onReconnect(() => {
        void queryClient.invalidateQueries({ queryKey: tasksKey });
        void queryClient.invalidateQueries({
          queryKey: orpc.projects.get.key({ input: { id: project.id } }),
        });
      }),
    [queryClient, tasksKey, project.id],
  );
}
