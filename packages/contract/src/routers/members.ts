import { z } from 'zod';
import { base } from '../base.ts';
import { Id, Timestamp } from '../schemas.ts';

export const Member = z.object({
  id: Id,
  userId: Id,
  name: z.string(),
  email: z.email(),
  image: z.string().nullable(),
  role: z.string(),
  joinedAt: Timestamp,
});
export type Member = z.infer<typeof Member>;

export const members = {
  list: base
    .route({
      method: 'GET',
      path: '/members',
      summary: 'Members of the active organization',
      tags: ['Members'],
    })
    .output(z.array(Member)),
};
