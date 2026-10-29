import { os, tenant } from '../orpc.ts';
import { relationsService } from '../services/relations.ts';

export const relations = {
  list: os.relations.list
    .use(tenant)
    .handler(({ context, input }) => relationsService.list(context, input.taskId)),
  add: os.relations.add
    .use(tenant)
    .handler(({ context, input }) => relationsService.add(context, input, context.clock.now())),
  remove: os.relations.remove
    .use(tenant)
    .handler(({ context, input }) =>
      relationsService.remove(context, input.id, context.clock.now()),
    ),
};
