import {
  createLabel,
  createStatus,
  deleteLabel,
  deleteStatus,
  findLabel,
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
import { visibleProject, writableProject } from './projects-access.ts';

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

export const membersService = {
  list: (actor: Actor) => listMembers(actor.scope),
};

export const labelsService = {
  async list(actor: Actor, projectId?: string) {
    if (projectId) await visibleProject(actor, projectId);
    return listLabels(actor.scope, projectId);
  },

  async create(actor: Actor, input: { projectId: string | null; name: string; color: string }) {
    authorize(actor, { label: ['create'] });
    if (input.projectId) await writableProject(actor, input.projectId);
    return createLabel(actor.scope, input).catch((error) => nameTaken(error, 'label'));
  },

  async update(actor: Actor, id: string, patch: { name?: string; color?: string }) {
    const current = await findLabel(actor.scope, id);
    if (!current) throw notFound('Label not found.');
    authorize(actor, { label: ['update'] });
    if (current.projectId) await writableProject(actor, current.projectId);
    const label = await updateLabel(actor.scope, id, patch).catch((error) =>
      nameTaken(error, 'label'),
    );
    if (!label) throw notFound('Label not found.');
    return label;
  },

  async delete(actor: Actor, id: string) {
    const current = await findLabel(actor.scope, id);
    if (!current) throw notFound('Label not found.');
    authorize(actor, { label: ['delete'] });
    if (current.projectId) await writableProject(actor, current.projectId);
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
    authorize(actor, { workflow: ['update'] });
    await writableProject(actor, input.projectId);
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
    const current = await findStatus(actor.scope, id);
    if (!current) throw notFound('Status not found.');
    authorize(actor, { workflow: ['update'] });
    await writableProject(actor, current.projectId);
    const status = await updateStatus(actor.scope, id, patch).catch((error) =>
      nameTaken(error, 'status'),
    );
    if (!status) throw notFound('Status not found.');
    return toStatus(status);
  },

  async deleteStatus(actor: Actor, id: string, moveTasksTo: string, now: Date) {
    const current = await findStatus(actor.scope, id);
    if (!current) throw notFound('Status not found.');
    authorize(actor, { workflow: ['update'] });
    await writableProject(actor, current.projectId);
    if (!(await deleteStatus(actor.scope, id, moveTasksTo, now)))
      throw notFound('Status not found.');
    return { id };
  },
};
