import { can } from '@teamflow/auth';
import { SavedView } from '@teamflow/contract';
import {
  createSavedView,
  deleteSavedView,
  findProject,
  findSavedView,
  listSavedViews,
  type SavedViewPatch,
  type SavedViewRow,
  uniqueViolation,
  updateSavedView,
} from '@teamflow/db';
import { TaskFilter } from '@teamflow/domain';
import { AppError, forbidden, notFound } from '../errors.ts';
import { type Actor, authorize } from './actor.ts';

/**
 * Saved views. Anyone can keep private views, guests included; sharing one with the workspace takes the right to
 * edit projects. Only the owner changes a view. Whoever can archive projects may also delete shared views.
 */

const nameTaken = (error: unknown): never => {
  if (uniqueViolation(error)) {
    throw new AppError('NAME_TAKEN', 'You already have a view with this name in this project.');
  }
  throw error;
};

const canModerate = (actor: Actor) => can(actor.member.role, { project: ['archive'] });

function toView(actor: Actor, row: SavedViewRow, ownerName: string): SavedView {
  const mine = row.ownerMemberId === actor.member.id;
  // Stored filters are re-read through the schema, so a shape change never reaches clients half-valid.
  const filter = TaskFilter.safeParse(row.filter);
  return {
    id: row.id,
    projectId: row.projectId,
    name: row.name,
    shared: row.shared,
    filter: filter.success ? filter.data : {},
    // Same for the sort: a column that no longer exists falls back to the default order instead of failing the
    // whole list for everyone who can see this view.
    sort: SavedView.shape.sort.safeParse(row.sort).data ?? null,
    direction: SavedView.shape.direction.safeParse(row.direction).data ?? null,
    version: row.version,
    ownerName,
    mine,
    canDelete: mine || (row.shared && canModerate(actor)),
    updatedAt: row.updatedAt,
  };
}

async function ownView(actor: Actor, id: string) {
  const row = await findSavedView(actor.scope, id);
  // Someone else's private view does not exist, as far as you can tell.
  if (!row || (!row.shared && row.ownerMemberId !== actor.member.id)) {
    throw notFound('View not found.');
  }
  return row;
}

export const viewsService = {
  async list(actor: Actor, projectId: string) {
    if (!(await findProject(actor.scope, projectId))) throw notFound('Project not found.');
    const rows = await listSavedViews(actor.scope, projectId, actor.member.id);
    return rows.map(({ view, ownerName }) => toView(actor, view, ownerName));
  },

  async create(
    actor: Actor,
    input: Omit<SavedView, 'id' | 'version' | 'ownerName' | 'mine' | 'canDelete' | 'updatedAt'>,
  ) {
    if (!(await findProject(actor.scope, input.projectId))) throw notFound('Project not found.');
    if (input.shared) authorize(actor, { project: ['update'] });
    const row = await createSavedView(actor.scope, actor.member.id, input).catch(nameTaken);
    return this.one(actor, row.id);
  },

  async update(actor: Actor, id: string, version: number, patch: SavedViewPatch, now: Date) {
    const row = await ownView(actor, id);
    if (row.ownerMemberId !== actor.member.id) throw forbidden();
    if (patch.shared) authorize(actor, { project: ['update'] });
    const updated = await updateSavedView(actor.scope, id, version, patch, now).catch(nameTaken);
    if (!updated) throw notFound('View not found.');
    return this.one(actor, id);
  },

  async delete(actor: Actor, id: string) {
    const row = await ownView(actor, id);
    if (row.ownerMemberId !== actor.member.id && !canModerate(actor)) throw forbidden();
    await deleteSavedView(actor.scope, id);
    return { id };
  },

  async one(actor: Actor, id: string) {
    const row = await findSavedView(actor.scope, id);
    if (!row) throw notFound('View not found.');
    const [listed] = (await listSavedViews(actor.scope, row.projectId, actor.member.id)).filter(
      ({ view }) => view.id === id,
    );
    if (!listed) throw notFound('View not found.');
    return toView(actor, listed.view, listed.ownerName);
  },
};
