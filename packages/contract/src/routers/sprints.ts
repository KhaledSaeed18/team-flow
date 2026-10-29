import { z } from 'zod';
import { base } from '../base.ts';
import { Id, Timestamp, Version } from '../schemas.ts';

export const SprintStatus = z.enum(['planned', 'active', 'completed']);

export const Sprint = z.object({
  id: Id,
  projectId: Id,
  name: z.string(),
  goal: z.string(),
  status: SprintStatus,
  startsAt: Timestamp,
  endsAt: Timestamp,
  startedAt: Timestamp.nullable(),
  completedAt: Timestamp.nullable(),
  committedPoints: z.number().int().nullable(),
  completedPoints: z.number().int().nullable(),
  version: Version,
});
export type Sprint = z.infer<typeof Sprint>;

const Totals = z.object({
  remainingTasks: z.number(),
  remainingPoints: z.number(),
  totalTasks: z.number(),
  totalPoints: z.number(),
});

export const SprintReport = z.object({
  sprint: Sprint,
  committed: Totals,
  days: z.array(Totals.extend({ at: Timestamp, idealPoints: z.number() })),
  scopeAdded: z.number(),
  scopeRemoved: z.number(),
  /** Tasks per stage at the end of each day: the cumulative flow diagram. */
  flow: z.array(
    z.object({ at: Timestamp, todo: z.number(), inProgress: z.number(), done: z.number() }),
  ),
  /** Average completed points over the last three completed sprints of the project. */
  velocity: z.number(),
  history: z.array(
    z.object({
      sprintId: Id,
      name: z.string(),
      committedPoints: z.number(),
      completedPoints: z.number(),
    }),
  ),
  /** Median time from first start to completion for work finished in this sprint, in hours. */
  medianCycleTimeHours: z.number().nullable(),
});
export type SprintReport = z.infer<typeof SprintReport>;

const Name = z.string().trim().min(1).max(80);
const Goal = z.string().max(500);
const tags = ['Sprints'];
const errors = {
  SPRINT_STATE: { status: 409, message: 'The sprint is not in a state that allows this.' },
  INVALID_REFERENCE: { status: 422, message: 'Something this refers to does not fit here.' },
};

export const sprints = {
  list: base
    .route({
      method: 'GET',
      path: '/projects/{projectId}/sprints',
      summary: 'Sprints of a project',
      tags,
    })
    .input(z.object({ projectId: Id }))
    .output(z.array(Sprint)),

  create: base
    .route({
      method: 'POST',
      path: '/projects/{projectId}/sprints',
      summary: 'Plan a sprint',
      tags,
      successStatus: 201,
    })
    .errors(errors)
    .input(
      z
        .object({
          projectId: Id,
          name: Name,
          goal: Goal.optional(),
          startsAt: Timestamp,
          endsAt: Timestamp,
        })
        .refine((v) => v.endsAt > v.startsAt, {
          message: 'A sprint must end after it starts.',
          path: ['endsAt'],
        }),
    )
    .output(Sprint),

  update: base
    .route({
      method: 'PATCH',
      path: '/sprints/{id}',
      summary: 'Rename or reschedule a sprint',
      tags,
    })
    .errors(errors)
    .input(
      z.object({
        id: Id,
        version: Version,
        name: Name.optional(),
        goal: Goal.optional(),
        startsAt: Timestamp.optional(),
        endsAt: Timestamp.optional(),
      }),
    )
    .output(Sprint),

  start: base
    .route({ method: 'POST', path: '/sprints/{id}/start', summary: 'Start a planned sprint', tags })
    .errors(errors)
    .input(z.object({ id: Id, version: Version }))
    .output(Sprint),

  complete: base
    .route({
      method: 'POST',
      path: '/sprints/{id}/complete',
      summary: 'Complete the active sprint',
      tags,
    })
    .errors(errors)
    .input(
      z.object({
        id: Id,
        version: Version,
        /** A planned sprint for unfinished work, or `null` to return it to the backlog. */
        carryOverTo: Id.nullable(),
      }),
    )
    .output(Sprint),

  report: base
    .route({
      method: 'GET',
      path: '/sprints/{id}/report',
      summary: 'Burndown, scope change and velocity',
      tags,
    })
    .input(z.object({ id: Id }))
    .output(SprintReport),
};
