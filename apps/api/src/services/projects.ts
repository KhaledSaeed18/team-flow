import {
  createProject,
  findProject,
  listProjects,
  listStatuses,
  type ProjectPatch,
  uniqueViolation,
  updateProject,
} from '@teamflow/db';
import { AppError, notFound } from '../errors.ts';
import { type Actor, authorize } from './actor.ts';
import { writableProject } from './projects-access.ts';

export const projectsService = {
  list(actor: Actor, includeArchived: boolean) {
    return listProjects(actor.scope, { includeArchived });
  },

  async get(actor: Actor, id: string) {
    const project = await findProject(actor.scope, id);
    if (!project) throw notFound('Project not found.');
    return { ...project, statuses: await listStatuses(actor.scope, id) };
  },

  async create(
    actor: Actor,
    input: {
      key: string;
      name: string;
      description?: string | undefined;
      color?: string | undefined;
      leadMemberId?: string | null | undefined;
    },
  ) {
    authorize(actor, { project: ['create'] });
    try {
      const { project, statuses } = await createProject(actor.scope, {
        key: input.key,
        name: input.name,
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.color !== undefined ? { color: input.color } : {}),
        leadMemberId: input.leadMemberId ?? null,
      });
      return { ...project, statuses };
    } catch (error) {
      const constraint = uniqueViolation(error);
      if (constraint?.includes('key'))
        throw new AppError('KEY_TAKEN', 'Another project already uses this key.');
      throw error;
    }
  },

  async update(actor: Actor, id: string, version: number, patch: ProjectPatch) {
    // Visibility first (404), then permission (403).
    await this.get(actor, id);
    authorize(actor, { project: ['update'] });
    await writableProject(actor, id);
    const updated = await updateProject(actor.scope, id, version, patch);
    if (!updated) throw notFound('Project not found.');
    return updated;
  },

  async setArchived(actor: Actor, id: string, version: number, archived: boolean, now: Date) {
    await this.get(actor, id);
    authorize(actor, { project: ['archive'] });
    const updated = await updateProject(
      actor.scope,
      id,
      version,
      { archivedAt: archived ? now : null },
      archived ? 'project.archived' : 'project.restored',
    );
    if (!updated) throw notFound('Project not found.');
    return updated;
  },
};
