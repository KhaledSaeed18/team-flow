import { ProjectKey, StatusCategory } from '@teamflow/domain';
import { z } from 'zod';
import { base } from '../base.ts';
import { Color, Flag, Id, Timestamp, Version } from '../schemas.ts';

export const WorkflowStatus = z.object({
  id: Id,
  name: z.string(),
  category: StatusCategory,
  color: z.string(),
  rank: z.string(),
});
export type WorkflowStatus = z.infer<typeof WorkflowStatus>;

export const Project = z.object({
  id: Id,
  key: z.string(),
  name: z.string(),
  description: z.string(),
  color: z.string(),
  leadMemberId: Id.nullable(),
  archivedAt: Timestamp.nullable(),
  version: Version,
  createdAt: Timestamp,
  updatedAt: Timestamp,
});
export type Project = z.infer<typeof Project>;

export const ProjectWithStatuses = Project.extend({ statuses: z.array(WorkflowStatus) });

const Name = z.string().trim().min(1).max(80);
const Description = z.string().max(2000);

const tags = ['Projects'];

export const projects = {
  list: base
    .route({ method: 'GET', path: '/projects', summary: 'List projects', tags })
    .input(z.object({ includeArchived: Flag.default(false) }).default({ includeArchived: false }))
    .output(z.array(Project)),

  get: base
    .route({
      method: 'GET',
      path: '/projects/{id}',
      summary: 'Get a project and its workflow',
      tags,
    })
    .input(z.object({ id: Id }))
    .output(ProjectWithStatuses),

  create: base
    .route({
      method: 'POST',
      path: '/projects',
      summary: 'Create a project',
      tags,
      successStatus: 201,
    })
    .errors({ KEY_TAKEN: { status: 409, message: 'Another project already uses this key.' } })
    .input(
      z.object({
        key: ProjectKey,
        name: Name,
        description: Description.optional(),
        color: Color.optional(),
        leadMemberId: Id.nullable().optional(),
      }),
    )
    .output(ProjectWithStatuses),

  update: base
    .route({ method: 'PATCH', path: '/projects/{id}', summary: 'Update a project', tags })
    .input(
      z.object({
        id: Id,
        version: Version,
        name: Name.optional(),
        description: Description.optional(),
        color: Color.optional(),
        leadMemberId: Id.nullable().optional(),
      }),
    )
    .output(Project),

  archive: base
    .route({ method: 'POST', path: '/projects/{id}/archive', summary: 'Archive a project', tags })
    .input(z.object({ id: Id, version: Version }))
    .output(Project),

  restore: base
    .route({
      method: 'POST',
      path: '/projects/{id}/restore',
      summary: 'Restore an archived project',
      tags,
    })
    .input(z.object({ id: Id, version: Version }))
    .output(Project),
};
