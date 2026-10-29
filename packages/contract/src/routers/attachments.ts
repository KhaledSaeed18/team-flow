import { z } from 'zod';
import { base } from '../base.ts';
import { Id, Timestamp } from '../schemas.ts';

/** Largest file accepted, in bytes. Uploads are plain `POST /api/tasks/:taskId/attachments` with the file body. */
export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;

export const Attachment = z.object({
  id: Id,
  fileName: z.string(),
  contentType: z.string(),
  sizeBytes: z.number().int(),
  createdAt: Timestamp,
  uploaderName: z.string().nullable(),
  /** Short-lived download link. */
  url: z.string(),
});
export type Attachment = z.infer<typeof Attachment>;

const tags = ['Attachments'];

export const attachments = {
  list: base
    .route({
      method: 'GET',
      path: '/tasks/{taskId}/attachments',
      summary: 'Files attached to a task',
      tags,
    })
    .input(z.object({ taskId: Id }))
    .output(z.array(Attachment)),

  delete: base
    .route({ method: 'DELETE', path: '/attachments/{id}', summary: 'Remove an attachment', tags })
    .input(z.object({ id: Id }))
    .output(z.object({ id: Id })),
};
