import { z } from 'zod';
import { base } from '../base.ts';
import { Id, OrganizationSummary, User } from '../schemas.ts';

export const me = {
  get: base
    .route({
      method: 'GET',
      path: '/me',
      summary: 'The signed-in user and their organizations',
      tags: ['Me'],
    })
    .output(
      z.object({
        user: User,
        activeOrganizationId: Id.nullable(),
        organizations: z.array(OrganizationSummary),
      }),
    ),
};
