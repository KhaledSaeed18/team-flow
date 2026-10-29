import { os, tenant } from '../orpc.ts';
import { tasksService } from '../services/tasks.ts';
import { withoutUndefined } from './util.ts';

export const tasks = {
  list: os.tasks.list
    .use(tenant)
    .handler(({ context, input }) => tasksService.list(context, input)),

  get: os.tasks.get
    .use(tenant)
    .handler(({ context, input }) => tasksService.get(context, input.id)),

  getByIdentifier: os.tasks.getByIdentifier
    .use(tenant)
    .handler(({ context, input }) => tasksService.getByIdentifier(context, input.identifier)),

  create: os.tasks.create
    .use(tenant)
    .handler(({ context, input }) => tasksService.create(context, input, context.clock.now())),

  update: os.tasks.update.use(tenant).handler(({ context, input }) => {
    const { id, version, ...patch } = input;
    return tasksService.update(context, id, version, withoutUndefined(patch), context.clock.now());
  }),

  move: os.tasks.move.use(tenant).handler(({ context, input }) => {
    const { id, version, ...placement } = input;
    return tasksService.move(context, id, version, placement, context.clock.now());
  }),

  delete: os.tasks.delete
    .use(tenant)
    .handler(({ context, input }) =>
      tasksService.delete(context, input.id, input.version, context.clock.now()),
    ),

  history: os.tasks.history
    .use(tenant)
    .handler(({ context, input }) => tasksService.history(context, input.id)),
};
