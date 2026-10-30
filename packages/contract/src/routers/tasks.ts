import { Priority } from '@teamflow/domain';
import { z } from 'zod';
import { base } from '../base.ts';
import { Id, Timestamp, Version } from '../schemas.ts';

export const Task = z.object({
  id: Id,
  projectId: Id,
  number: z.number().int(),
  /** `TF-42` */
  identifier: z.string(),
  title: z.string(),
  description: z.string(),
  statusId: Id,
  priority: Priority,
  estimate: z.number().int().nullable(),
  assigneeMemberId: Id.nullable(),
  parentTaskId: Id.nullable(),
  sprintId: Id.nullable(),
  dueDate: z.iso.date().nullable(),
  rank: z.string(),
  labelIds: z.array(Id),
  startedAt: Timestamp.nullable(),
  completedAt: Timestamp.nullable(),
  canceledAt: Timestamp.nullable(),
  createdByMemberId: Id.nullable(),
  version: Version,
  createdAt: Timestamp,
  updatedAt: Timestamp,
});
export type Task = z.infer<typeof Task>;

export const ActivityEntry = z.object({
  id: Id,
  kind: z.string(),
  actorMemberId: Id.nullable(),
  changes: z.array(z.object({ field: z.string(), from: z.unknown(), to: z.unknown() })),
  createdAt: Timestamp,
});
export type ActivityEntry = z.infer<typeof ActivityEntry>;

const Title = z.string().trim().min(1).max(250);
const Description = z.string().max(50_000);
const Estimate = z.number().int().min(0).max(100);
const DueDate = z.iso.date();

const errors = {
  INVALID_REFERENCE: {
    status: 422,
    message: 'Something this refers to does not fit here.',
  },
  // Planning a task into, or out of, a completed sprint.
  SPRINT_STATE: { status: 409, message: 'The sprint is not in a state that allows this.' },
} as const;

const tags = ['Tasks'];

export const tasks = {
  list: base
    .route({
      method: 'GET',
      path: '/projects/{projectId}/tasks',
      summary: 'List tasks in board order',
      tags,
    })
    .input(
      z.object({
        projectId: Id,
        statusIds: z.array(Id).optional(),
        /** A member id, or `null` for unassigned. */
        assigneeMemberId: Id.nullable().optional(),
        parentTaskId: Id.optional(),
        /** A sprint id, or `null` for the backlog (tasks in no sprint). */
        sprintId: Id.nullable().optional(),
      }),
    )
    .output(z.array(Task)),

  get: base
    .route({ method: 'GET', path: '/tasks/{id}', summary: 'Get a task', tags })
    .input(z.object({ id: Id }))
    .output(Task),

  getByIdentifier: base
    .route({
      method: 'GET',
      path: '/tasks/by-identifier/{identifier}',
      summary: 'Get a task by `KEY-123`',
      tags,
    })
    .input(z.object({ identifier: z.string().max(20) }))
    .output(Task),

  create: base
    .route({ method: 'POST', path: '/tasks', summary: 'Create a task', tags, successStatus: 201 })
    .errors(errors)
    .input(
      z.object({
        /** Optional client-generated UUID, so the client can render the task before the server answers. */
        id: Id.optional(),
        projectId: Id,
        title: Title,
        description: Description.optional(),
        statusId: Id.optional(),
        priority: Priority.optional(),
        estimate: Estimate.nullable().optional(),
        assigneeMemberId: Id.nullable().optional(),
        parentTaskId: Id.nullable().optional(),
        sprintId: Id.nullable().optional(),
        dueDate: DueDate.nullable().optional(),
        labelIds: z.array(Id).max(20).optional(),
      }),
    )
    .output(Task),

  update: base
    .route({ method: 'PATCH', path: '/tasks/{id}', summary: 'Update a task', tags })
    .errors(errors)
    .input(
      z.object({
        id: Id,
        version: Version,
        title: Title.optional(),
        description: Description.optional(),
        statusId: Id.optional(),
        priority: Priority.optional(),
        estimate: Estimate.nullable().optional(),
        assigneeMemberId: Id.nullable().optional(),
        parentTaskId: Id.nullable().optional(),
        sprintId: Id.nullable().optional(),
        dueDate: DueDate.nullable().optional(),
        labelIds: z.array(Id).max(20).optional(),
      }),
    )
    .output(Task),

  move: base
    .route({ method: 'POST', path: '/tasks/{id}/move', summary: 'Move a task on the board', tags })
    .errors(errors)
    .input(
      z.object({
        id: Id,
        version: Version,
        statusId: Id,
        /** The task it should come after; `null` for the top of the column. */
        afterId: Id.nullable().optional(),
        /** The task it should come before; `null` for the bottom of the column. */
        beforeId: Id.nullable().optional(),
      }),
    )
    .output(Task),

  delete: base
    .route({ method: 'DELETE', path: '/tasks/{id}', summary: 'Delete a task', tags })
    .input(z.object({ id: Id, version: Version }))
    .output(z.object({ id: Id })),

  history: base
    .route({
      method: 'GET',
      path: '/tasks/{id}/history',
      summary: 'Everything that happened to a task',
      tags,
    })
    .input(z.object({ id: Id }))
    .output(z.array(ActivityEntry)),
};
