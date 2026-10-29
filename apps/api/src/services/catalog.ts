import {
  createLabel,
  createStatus,
  deleteLabel,
  deleteStatus,
  findLabel,
  findProject,
  findStatus,
  listLabels,
  listMembers,
  type StatusRow,
  uniqueViolation,
  updateLabel,
  updateStatus,
} from '@teamflow/db';
import type { StatusCategory } from '@teamflow/domain';
import { AppError, notFound } from '../errors.ts';
import { type Actor, authorize } from './actor.ts';

/** Members, labels and workflow statuses: the vocabulary tasks are described with. */

const nameTaken = (error: unknown, what: string): never => {
  if (uniqueViolation(error))
    throw new AppError('NAME_TAKEN', `A ${what} with this name already exists here.`);
  throw error;
};

const toStatus = ({ id, name, category, color, rank }: StatusRow) => ({
  id,
  name,
  category,
  color,
  rank,
});

async function visibleProject(actor: Actor, projectId: string) {
  const project = await findProject(actor.scope, projectId);
  if (!project) throw notFound('Project not found.');
  return project;
}

export const membersService = {
  list: (actor: Actor) => listMembers(actor.scope),
};

export const labelsService = {
  async list(actor: Actor, projectId?: string) {
    if (projectId) await visibleProject(actor, projectId);
    return listLabels(actor.scope, projectId);
  },

  async create(actor: Actor, input: { projectId: string | null; name: string; color: string }) {
    if (input.projectId) await visibleProject(actor, input.projectId);
    authorize(actor, { label: ['create'] });
    return createLabel(actor.scope, input).catch((error) => nameTaken(error, 'label'));
  },

  async update(actor: Actor, id: string, patch: { name?: string; color?: string }) {
    if (!(await findLabel(actor.scope, id))) throw notFound('Label not found.');
    authorize(actor, { label: ['update'] });
    const label = await updateLabel(actor.scope, id, patch).catch((error) =>
      nameTaken(error, 'label'),
    );
    if (!label) throw notFound('Label not found.');
    return label;
  },

  async delete(actor: Actor, id: string) {
    if (!(await findLabel(actor.scope, id))) throw notFound('Label not found.');
    authorize(actor, { label: ['delete'] });
    if (!(await deleteLabel(actor.scope, id))) throw notFound('Label not found.');
    return { id };
  },
};

export const workflowService = {
  async createStatus(
    actor: Actor,
    input: {
      projectId: string;
      name: string;
      category: StatusCategory;
      color: string;
      afterId?: string | null | undefined;
    },
  ) {
    await visibleProject(actor, input.projectId);
    authorize(actor, { workflow: ['update'] });
    const status = await createStatus(actor.scope, input).catch((error) =>
      nameTaken(error, 'status'),
    );
    if (!status) throw notFound('Project not found.');
    return toStatus(status);
  },

  async updateStatus(
    actor: Actor,
    id: string,
    patch: {
      name?: string;
      color?: string;
      category?: StatusCategory;
      afterId?: string | null | undefined;
    },
  ) {
    if (!(await findStatus(actor.scope, id))) throw notFound('Status not found.');
    authorize(actor, { workflow: ['update'] });
    const status = await updateStatus(actor.scope, id, patch).catch((error) =>
      nameTaken(error, 'status'),
    );
    if (!status) throw notFound('Status not found.');
    return toStatus(status);
  },

  async deleteStatus(actor: Actor, id: string, moveTasksTo: string, now: Date) {
    if (!(await findStatus(actor.scope, id))) throw notFound('Status not found.');
    authorize(actor, { workflow: ['update'] });
    if (!(await deleteStatus(actor.scope, id, moveTasksTo, now)))
      throw notFound('Status not found.');
    return { id };
  },
};
