import { os, tenant } from '../orpc.ts';
import { viewsService } from '../services/views.ts';
import { withoutUndefined } from './util.ts';

export const views = {
  list: os.views.list
    .use(tenant)
    .handler(({ context, input }) => viewsService.list(context, input.projectId)),
  create: os.views.create
    .use(tenant)
    .handler(({ context, input }) => viewsService.create(context, input)),
  update: os.views.update.use(tenant).handler(({ context, input }) => {
    const { id, version, ...patch } = input;
    return viewsService.update(context, id, version, withoutUndefined(patch), context.clock.now());
  }),
  delete: os.views.delete
    .use(tenant)
    .handler(({ context, input }) => viewsService.delete(context, input.id)),
};
