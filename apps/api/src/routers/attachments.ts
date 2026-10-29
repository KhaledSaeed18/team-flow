import { os, tenant } from '../orpc.ts';
import { attachmentsService } from '../services/attachments.ts';

export const attachments = {
  list: os.attachments.list
    .use(tenant)
    .handler(({ context, input }) =>
      attachmentsService(context.storage).list(context, input.taskId),
    ),
  delete: os.attachments.delete
    .use(tenant)
    .handler(({ context, input }) =>
      attachmentsService(context.storage).delete(context, input.id, context.clock.now()),
    ),
};
