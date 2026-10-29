import { z } from 'zod';
import { base } from '../base.ts';
import { Color, Id, Timestamp } from '../schemas.ts';

export const Label = z.object({
  id: Id,
  projectId: Id.nullable(),
  name: z.string(),
  color: z.string(),
  createdAt: Timestamp,
});
export type Label = z.infer<typeof Label>;

const Name = z.string().trim().min(1).max(40);
const tags = ['Labels'];
const NAME_TAKEN = {
  NAME_TAKEN: { status: 409, message: 'A label with this name already exists here.' },
};

export const labels = {
  list: base
    .route({
      method: 'GET',
      path: '/labels',
      summary: 'Organization labels, plus one project’s',
      tags,
    })
    .input(z.object({ projectId: Id.optional() }).default({}))
    .output(z.array(Label)),

  create: base
    .route({ method: 'POST', path: '/labels', summary: 'Create a label', tags, successStatus: 201 })
    .errors(NAME_TAKEN)
    .input(z.object({ projectId: Id.nullable().default(null), name: Name, color: Color }))
    .output(Label),

  update: base
    .route({ method: 'PATCH', path: '/labels/{id}', summary: 'Rename or recolor a label', tags })
    .errors(NAME_TAKEN)
    .input(z.object({ id: Id, name: Name.optional(), color: Color.optional() }))
    .output(Label),

  delete: base
    .route({ method: 'DELETE', path: '/labels/{id}', summary: 'Delete a label', tags })
    .input(z.object({ id: Id }))
    .output(z.object({ id: Id })),
};
