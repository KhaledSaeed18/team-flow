import { StatusCategory } from '@teamflow/domain';
import { z } from 'zod';
import { base } from '../base.ts';
import { Color, Id } from '../schemas.ts';
import { WorkflowStatus } from './projects.ts';

const Name = z.string().trim().min(1).max(40);
const tags = ['Workflow'];
const errors = {
  INVALID_WORKFLOW: { status: 422, message: 'That change would break the workflow.' },
  INVALID_REFERENCE: { status: 422, message: 'Something this refers to does not fit here.' },
  NAME_TAKEN: { status: 409, message: 'A status with this name already exists in this workflow.' },
};

export const workflow = {
  createStatus: base
    .route({
      method: 'POST',
      path: '/projects/{projectId}/statuses',
      summary: 'Add a status',
      tags,
      successStatus: 201,
    })
    .errors(errors)
    .input(
      z.object({
        projectId: Id,
        name: Name,
        category: StatusCategory,
        color: Color,
        /** Place after this status; `null` for first; omitted for last. */
        afterId: Id.nullable().optional(),
      }),
    )
    .output(WorkflowStatus),

  updateStatus: base
    .route({
      method: 'PATCH',
      path: '/statuses/{id}',
      summary: 'Rename, recolor, re-type or reorder a status',
      tags,
    })
    .errors(errors)
    .input(
      z.object({
        id: Id,
        name: Name.optional(),
        color: Color.optional(),
        category: StatusCategory.optional(),
        afterId: Id.nullable().optional(),
      }),
    )
    .output(WorkflowStatus),

  deleteStatus: base
    .route({
      method: 'DELETE',
      path: '/statuses/{id}',
      summary: 'Delete a status, moving its tasks',
      tags,
    })
    .errors(errors)
    .input(z.object({ id: Id, moveTasksTo: Id }))
    .output(z.object({ id: Id })),
};
