import { os, tenant } from '../orpc.ts';
import { projectsService } from '../services/projects.ts';

const withoutUndefined = <T extends Record<string, unknown>>(value: T) =>
  Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as {
    [K in keyof T]?: Exclude<T[K], undefined>;
  };

export const projects = {
  list: os.projects.list
    .use(tenant)
    .handler(({ context, input }) => projectsService.list(context, input.includeArchived)),

  get: os.projects.get
    .use(tenant)
    .handler(({ context, input }) => projectsService.get(context, input.id)),

  create: os.projects.create
    .use(tenant)
    .handler(({ context, input }) => projectsService.create(context, input)),

  update: os.projects.update.use(tenant).handler(({ context, input }) => {
    const { id, version, ...patch } = input;
    return projectsService.update(context, id, version, withoutUndefined(patch));
  }),

  archive: os.projects.archive
    .use(tenant)
    .handler(({ context, input }) =>
      projectsService.setArchived(context, input.id, input.version, true, context.clock.now()),
    ),

  restore: os.projects.restore
    .use(tenant)
    .handler(({ context, input }) =>
      projectsService.setArchived(context, input.id, input.version, false, context.clock.now()),
    ),
};
