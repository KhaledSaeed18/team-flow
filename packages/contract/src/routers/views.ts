import { TaskFilter } from '@teamflow/domain';
import { z } from 'zod';
import { base } from '../base.ts';
import { Id, Timestamp, Version } from '../schemas.ts';

/** Columns the list view sorts by. */
export const LIST_SORTS = [
  'identifier',
  'title',
  'status',
  'priority',
  'assignee',
  'estimate',
  'sprint',
  'updated',
] as const;
export const ListSort = z.enum(LIST_SORTS);
export const SortDirection = z.enum(['ascending', 'descending']);

export const SavedView = z.object({
  id: Id,
  projectId: Id,
  name: z.string(),
  shared: z.boolean(),
  filter: TaskFilter,
  sort: ListSort.nullable(),
  direction: SortDirection.nullable(),
  version: Version,
  ownerName: z.string(),
  /** The caller made it, so they may change or delete it. Admins may also delete shared views. */
  mine: z.boolean(),
  canDelete: z.boolean(),
  updatedAt: Timestamp,
});
export type SavedView = z.infer<typeof SavedView>;

const Name = z.string().trim().min(1).max(60);
const tags = ['Saved views'];
const NAME_TAKEN = {
  NAME_TAKEN: { status: 409, message: 'You already have a view with this name in this project.' },
};

export const views = {
  list: base
    .route({
      method: 'GET',
      path: '/projects/{projectId}/views',
      summary: 'Your views in a project, and shared ones',
      tags,
    })
    .input(z.object({ projectId: Id }))
    .output(z.array(SavedView)),

  create: base
    .route({ method: 'POST', path: '/views', summary: 'Save a view', tags, successStatus: 201 })
    .errors(NAME_TAKEN)
    .input(
      z.object({
        projectId: Id,
        name: Name,
        shared: z.boolean().default(false),
        filter: TaskFilter,
        sort: ListSort.nullable().default(null),
        direction: SortDirection.nullable().default(null),
      }),
    )
    .output(SavedView),

  update: base
    .route({
      method: 'PATCH',
      path: '/views/{id}',
      summary: 'Rename, share or re-save a view',
      tags,
    })
    .errors(NAME_TAKEN)
    .input(
      z.object({
        id: Id,
        version: Version,
        name: Name.optional(),
        shared: z.boolean().optional(),
        filter: TaskFilter.optional(),
        sort: ListSort.nullable().optional(),
        direction: SortDirection.nullable().optional(),
      }),
    )
    .output(SavedView),

  delete: base
    .route({ method: 'DELETE', path: '/views/{id}', summary: 'Delete a view', tags })
    .input(z.object({ id: Id }))
    .output(z.object({ id: Id })),
};
