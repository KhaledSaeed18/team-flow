import {
  type CreateTaskInput,
  createTask,
  deleteTask,
  findProject,
  findTask,
  findTaskByNumber,
  listTasks,
  type MoveInput,
  moveTask,
  type TaskFilter,
  type TaskPatch,
  type TaskWithLabels,
  taskHistory,
  uniqueViolation,
  updateTask,
} from '@teamflow/db';
import { parseTaskIdentifier, taskIdentifier } from '@teamflow/domain';
import { AppError, notFound } from '../errors.ts';
import { type Actor, authorize } from './actor.ts';
import { writableProject } from './projects-access.ts';

const toWire = (task: TaskWithLabels, projectKey: string) => {
  const { organizationId: _org, deletedAt: _deleted, ...rest } = task;
  return { ...rest, identifier: taskIdentifier(projectKey, task.number) };
};

async function projectKeyOf(actor: Actor, projectId: string) {
  const project = await findProject(actor.scope, projectId);
  if (!project) throw notFound('Project not found.');
  return project;
}

async function load(actor: Actor, id: string) {
  const task = await findTask(actor.scope, id);
  if (!task) throw notFound('Task not found.');
  return task;
}

export const tasksService = {
  async list(actor: Actor, filter: TaskFilter) {
    const project = await projectKeyOf(actor, filter.projectId);
    const rows = await listTasks(actor.scope, filter);
    return rows.map((task) => toWire(task, project.key));
  },

  async get(actor: Actor, id: string) {
    const task = await load(actor, id);
    const project = await projectKeyOf(actor, task.projectId);
    return toWire(task, project.key);
  },

  async getByIdentifier(actor: Actor, identifier: string) {
    const parsed = parseTaskIdentifier(identifier);
    if (!parsed) throw notFound('Task not found.');
    const task = await findTaskByNumber(actor.scope, parsed.key, parsed.number);
    if (!task) throw notFound('Task not found.');
    return toWire(task, parsed.key);
  },

  async create(actor: Actor, input: CreateTaskInput, now: Date) {
    const project = await writableProject(actor, input.projectId);
    authorize(actor, { task: ['create'] });
    // Clients may choose the id, so an optimistic create can be retried safely: the same id in the same project
    // returns the task already made. Any other clash is a conflict, never a server error.
    if (input.id) {
      const existing = await findTask(actor.scope, input.id);
      if (existing?.projectId === input.projectId) return toWire(existing, project.key);
    }
    const task = await createTask(actor.scope, input, now).catch((error: unknown) => {
      if (uniqueViolation(error)) {
        throw new AppError('CONFLICT', 'That task id is already taken. Create the task again.');
      }
      throw error;
    });
    if (!task) throw notFound('Project not found.');
    return toWire(task, project.key);
  },

  async update(actor: Actor, id: string, version: number, patch: TaskPatch, now: Date) {
    const current = await load(actor, id);
    const project = await writableProject(actor, current.projectId);
    authorize(actor, { task: ['update'] });
    const task = await updateTask(actor.scope, id, version, patch, now);
    if (!task) throw notFound('Task not found.');
    return toWire(task, project.key);
  },

  async move(actor: Actor, id: string, version: number, input: MoveInput, now: Date) {
    const current = await load(actor, id);
    const project = await writableProject(actor, current.projectId);
    authorize(actor, { task: ['update'] });
    const task = await moveTask(actor.scope, id, version, input, now);
    if (!task) throw notFound('Task not found.');
    return toWire(task, project.key);
  },

  async delete(actor: Actor, id: string, version: number, now: Date) {
    const current = await load(actor, id);
    await writableProject(actor, current.projectId);
    authorize(actor, { task: ['delete'] });
    if (!(await deleteTask(actor.scope, id, version, now))) throw notFound('Task not found.');
    return { id };
  },

  async history(actor: Actor, id: string) {
    await load(actor, id);
    const rows = await taskHistory(actor.scope, id);
    return rows.map(({ id: entryId, kind, actorMemberId, changes, createdAt }) => ({
      id: entryId,
      kind,
      actorMemberId,
      changes,
      createdAt,
    }));
  },
};
