import { os, tenant } from '../orpc.ts';
import { sprintsService } from '../services/sprints.ts';
import { withoutUndefined } from './util.ts';

export const sprints = {
  list: os.sprints.list
    .use(tenant)
    .handler(({ context, input }) => sprintsService.list(context, input.projectId)),
  create: os.sprints.create
    .use(tenant)
    .handler(({ context, input }) => sprintsService.create(context, input)),
  update: os.sprints.update.use(tenant).handler(({ context, input }) => {
    const { id, version, ...patch } = input;
    return sprintsService.update(context, id, version, withoutUndefined(patch));
  }),
  start: os.sprints.start
    .use(tenant)
    .handler(({ context, input }) =>
      sprintsService.start(context, input.id, input.version, context.clock.now()),
    ),
  complete: os.sprints.complete
    .use(tenant)
    .handler(({ context, input }) =>
      sprintsService.complete(
        context,
        input.id,
        input.version,
        input.carryOverTo,
        context.clock.now(),
      ),
    ),
  report: os.sprints.report
    .use(tenant)
    .handler(({ context, input }) => sprintsService.report(context, input.id, context.clock.now())),
};
