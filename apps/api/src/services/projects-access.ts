import { findProject, findTask } from '@teamflow/db';
import { AppError, notFound } from '../errors.ts';
import type { Actor } from './actor.ts';

/** A project the actor can see, or NOT_FOUND. */
export async function visibleProject(actor: Actor, projectId: string) {
  const project = await findProject(actor.scope, projectId);
  if (!project) throw notFound('Project not found.');
  return project;
}

/** Archived projects are read-only: anything that changes one, or what is in it, is refused. */
export async function writableProject(actor: Actor, projectId: string) {
  const project = await visibleProject(actor, projectId);
  if (project.archivedAt) throw new AppError('FORBIDDEN', 'This project is archived.');
  return project;
}

/** A task the actor can see, in a project that is not archived. */
export async function writableTask(actor: Actor, taskId: string) {
  const task = await findTask(actor.scope, taskId);
  if (!task) throw notFound('Task not found.');
  await writableProject(actor, task.projectId);
  return task;
}
