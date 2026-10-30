import { ProjectKey } from '@teamflow/domain';
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

  /** Which of your workspaces has a project with this key (a project link names no workspace). */
  locateProject: base
    .route({
      method: 'GET',
      path: '/me/projects/{key}/workspaces',
      summary: 'Your workspaces that have a project with this key',
      tags: ['Me'],
    })
    .input(z.object({ key: ProjectKey }))
    .output(z.object({ organizations: z.array(z.object({ id: Id, name: z.string() })) })),
};
