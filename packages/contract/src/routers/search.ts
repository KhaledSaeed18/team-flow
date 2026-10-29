import { StatusCategory } from '@teamflow/domain';
import { z } from 'zod';
import { base } from '../base.ts';
import { Id } from '../schemas.ts';

export const TaskHit = z.object({
  id: Id,
  identifier: z.string(),
  title: z.string(),
  projectId: Id,
  projectKey: z.string(),
  projectName: z.string(),
  projectColor: z.string(),
  statusName: z.string(),
  statusCategory: StatusCategory,
});
export type TaskHit = z.infer<typeof TaskHit>;

export const search = {
  tasks: base
    .route({
      method: 'GET',
      path: '/search/tasks',
      summary: 'Search tasks by text or identifier',
      tags: ['Search'],
    })
    .input(
      z.object({
        q: z.string().max(200),
        limit: z.coerce.number().int().min(1).max(50).default(20),
      }),
    )
    .output(z.array(TaskHit)),
};
