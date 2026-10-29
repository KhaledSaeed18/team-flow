import { RelationType, StatusCategory } from '@teamflow/domain';
import { z } from 'zod';
import { base } from '../base.ts';
import { Id } from '../schemas.ts';

export const Relation = z.object({
  id: Id,
  type: RelationType,
  /** `outgoing`: this task → the other ("blocks"); `incoming`: the other → this task ("blocked by"). */
  direction: z.enum(['outgoing', 'incoming']),
  task: z.object({
    id: Id,
    identifier: z.string(),
    title: z.string(),
    statusCategory: StatusCategory,
  }),
});
export type Relation = z.infer<typeof Relation>;

/** How a relation reads from the task it is added on. `blocked_by` is stored as the other task blocking this one. */
export const RelationKind = z.enum(['blocks', 'blocked_by', 'relates', 'duplicates']);
export type RelationKind = z.infer<typeof RelationKind>;

const tags = ['Relations'];
const errors = {
  INVALID_REFERENCE: { status: 422, message: 'Something this refers to does not fit here.' },
};

export const relations = {
  list: base
    .route({
      method: 'GET',
      path: '/tasks/{taskId}/relations',
      summary: 'Relations of a task',
      tags,
    })
    .input(z.object({ taskId: Id }))
    .output(z.array(Relation)),

  add: base
    .route({
      method: 'POST',
      path: '/tasks/{taskId}/relations',
      summary: 'Relate two tasks',
      tags,
      successStatus: 201,
    })
    .errors(errors)
    .input(z.object({ taskId: Id, kind: RelationKind, otherTaskId: Id }))
    .output(z.object({ id: Id })),

  remove: base
    .route({ method: 'DELETE', path: '/relations/{id}', summary: 'Remove a relation', tags })
    .input(z.object({ id: Id }))
    .output(z.object({ id: Id })),
};
