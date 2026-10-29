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
  updateTask,
} from '@teamflow/db';
import { parseTaskIdentifier, taskIdentifier } from '@teamflow/domain';
import { AppError, notFound } from '../errors.ts';
import { type Actor, authorize } from './actor.ts';

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

/** Writes need the project to be open; archived projects are read-only. */
async function writableProject(actor: Actor, projectId: string) {
  const project = await projectKeyOf(actor, projectId);
  if (project.archivedAt) throw new AppError('FORBIDDEN', 'This project is archived.');
  return project;
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
    const task = await createTask(actor.scope, input, now);
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
